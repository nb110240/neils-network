import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { buildRequest } from "../helpers/mock-request"

// ─── Route mocks ───
// The webhook has NO normal auth — it verifies a Stripe signature instead.
// The hoisted holder lets each test control constructEvent (valid event vs throw),
// the customer retrieve result, and the subscriptions table read.
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  event: null as unknown,
  constructThrows: false,
  customer: { deleted: false, metadata: { user_id: "u1" } } as unknown,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.supabase),
  createServiceClient: vi.fn(async () => h.supabase),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: vi.fn(() => {
        if (h.constructThrows) throw new Error("No signatures found matching the expected signature")
        return h.event
      }),
    },
    customers: {
      retrieve: vi.fn(async () => h.customer),
    },
    subscriptions: {
      retrieve: vi.fn(async () => ({
        id: "sub_123",
        current_period_end: Math.floor(Date.now() / 1000) + 86_400,
        status: "active",
      })),
    },
  })),
}))

import { POST } from "@/app/api/stripe/webhook/route"

function webhookRequest(headers: Record<string, string> = {}) {
  return buildRequest({
    method: "POST",
    url: "http://localhost/api/stripe/webhook",
    body: "{}",
    headers: { "content-type": "application/json", ...headers },
  })
}

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    h.supabase = createMockSupabase({})
    h.event = null
    h.constructThrows = false
    h.customer = { deleted: false, metadata: { user_id: "u1" } }
  })

  it("returns 400 when the stripe-signature header is missing", async () => {
    const res = await POST(webhookRequest())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.message).toBe("Missing signature")
  })

  it("returns 400 when signature verification fails", async () => {
    h.constructThrows = true
    const res = await POST(webhookRequest({ "stripe-signature": "bad_sig" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.message).toBe("Invalid signature")
  })

  it("processes checkout.session.completed and activates the subscription", async () => {
    h.event = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { user_id: "u1" },
          customer: "cus_1",
          subscription: "sub_123",
        },
      },
    }
    const res = await POST(webhookRequest({ "stripe-signature": "good_sig" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(h.supabase!._queryBuilder.upsert).toHaveBeenCalled()
  })

  it("skips upsert when the Stripe customer does not belong to the claimed user", async () => {
    h.event = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { user_id: "u1" },
          customer: "cus_1",
          subscription: "sub_123",
        },
      },
    }
    // customer metadata points at a different user — spoofing attempt
    h.customer = { deleted: false, metadata: { user_id: "attacker" } }
    const res = await POST(webhookRequest({ "stripe-signature": "good_sig" }))
    expect(res.status).toBe(200)
    expect(h.supabase!._queryBuilder.upsert).not.toHaveBeenCalled()
  })

  it("processes customer.subscription.deleted", async () => {
    h.event = {
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123" } },
    }
    const res = await POST(webhookRequest({ "stripe-signature": "good_sig" }))
    expect(res.status).toBe(200)
    expect(h.supabase!._queryBuilder.update).toHaveBeenCalled()
  })

  it("ignores an unhandled event type but still returns 200", async () => {
    h.event = { type: "payment_intent.created", data: { object: {} } }
    const res = await POST(webhookRequest({ "stripe-signature": "good_sig" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })
})
