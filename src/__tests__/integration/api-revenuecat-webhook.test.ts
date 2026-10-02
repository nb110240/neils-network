import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { buildRequest } from "../helpers/mock-request"
import { signSubscriberAttribute } from "@/lib/revenuecat"

// RevenueCat webhook: native IAP -> subscriptions table. Every case runs for
// both stores so a Google Play purchase behaves exactly like an App Store one.

const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.supabase),
  createServiceClient: vi.fn(async () => h.supabase),
}))

vi.mock("@/lib/logger", () => ({ log: vi.fn() }))

import { POST } from "@/app/api/native/revenuecat-webhook/route"

const USER = "11111111-1111-4111-8111-111111111111"
const AUTH = "test-webhook-auth"
const SECRET = "test-attribute-secret"
const STORES = ["APP_STORE", "PLAY_STORE"] as const

function rcEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      type: "INITIAL_PURCHASE",
      store: "PLAY_STORE",
      app_user_id: USER,
      expiration_at_ms: Date.parse("2026-11-02T00:00:00Z"),
      entitlement_ids: ["pro"],
      subscriber_attributes: { savvo_sig: { value: signSubscriberAttribute(USER) } },
      ...overrides,
    },
  }
}

function webhook(body: unknown, auth: string | null = AUTH) {
  return buildRequest({
    method: "POST",
    url: "http://localhost/api/native/revenuecat-webhook",
    body,
    headers: auth ? { authorization: auth } : {},
  })
}

describe("POST /api/native/revenuecat-webhook", () => {
  beforeEach(() => {
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTH", AUTH)
    vi.stubEnv("REVENUECAT_ATTRIBUTE_SECRET", SECRET)
    h.supabase = createMockSupabase({ queryResult: { data: null, error: null } })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects a missing or wrong Authorization header", async () => {
    expect((await POST(webhook(rcEvent(), null))).status).toBe(401)
    expect((await POST(webhook(rcEvent(), "nope"))).status).toBe(401)
    expect(h.supabase!.from).not.toHaveBeenCalled()
  })

  for (const store of STORES) {
    describe(`store ${store}`, () => {
      it.each(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "SUBSCRIPTION_EXTENDED"])(
        "%s grants Pro",
        async (type) => {
          const res = await POST(webhook(rcEvent({ store, type })))
          expect(res.status).toBe(200)
          expect(h.supabase!.from).toHaveBeenCalledWith("subscriptions")
          expect(h.supabase!._queryBuilder.upsert).toHaveBeenCalledWith(
            {
              user_id: USER,
              plan: "pro",
              status: "active",
              current_period_end: "2026-11-02T00:00:00.000Z",
            },
            { onConflict: "user_id" },
          )
        },
      )

      it("SUBSCRIPTION_EXTENDED no newer than the stored period end changes nothing", async () => {
        // A later RENEWAL already stored a further period end.
        h.supabase!._queryBuilder.maybeSingle.mockResolvedValueOnce({
          data: { current_period_end: "2026-12-02T00:00:00.000Z" },
          error: null,
        })
        expect((await POST(webhook(rcEvent({ store, type: "SUBSCRIPTION_EXTENDED" })))).status).toBe(200)
        expect(h.supabase!._queryBuilder.upsert).not.toHaveBeenCalled()

        // A retry of the same extension, after an EXPIRATION.
        h.supabase!._queryBuilder.maybeSingle.mockResolvedValueOnce({
          data: { current_period_end: "2026-11-02T00:00:00.000Z" },
          error: null,
        })
        expect((await POST(webhook(rcEvent({ store, type: "SUBSCRIPTION_EXTENDED" })))).status).toBe(200)
        expect(h.supabase!._queryBuilder.upsert).not.toHaveBeenCalled()
      })

      it("SUBSCRIPTION_EXTENDED past the stored period end extends it", async () => {
        h.supabase!._queryBuilder.maybeSingle.mockResolvedValueOnce({
          data: { current_period_end: "2026-10-20T00:00:00.000Z" },
          error: null,
        })
        expect((await POST(webhook(rcEvent({ store, type: "SUBSCRIPTION_EXTENDED" })))).status).toBe(200)
        expect(h.supabase!._queryBuilder.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ status: "active", current_period_end: "2026-11-02T00:00:00.000Z" }),
          { onConflict: "user_id" },
        )
      })

      it("SUBSCRIPTION_EXTENDED asks for a retry when the stored period can't be read", async () => {
        h.supabase!._queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "timeout" } })
        expect((await POST(webhook(rcEvent({ store, type: "SUBSCRIPTION_EXTENDED" })))).status).toBe(500)
        expect(h.supabase!._queryBuilder.upsert).not.toHaveBeenCalled()
      })

      it("EXPIRATION downgrades to free", async () => {
        const res = await POST(webhook(rcEvent({ store, type: "EXPIRATION" })))
        expect(res.status).toBe(200)
        expect(h.supabase!._queryBuilder.update).toHaveBeenCalledWith({
          plan: "free",
          status: "canceled",
        })
        expect(h.supabase!._queryBuilder.upsert).not.toHaveBeenCalled()
      })

      it.each(["CANCELLATION", "BILLING_ISSUE", "SUBSCRIPTION_PAUSED"])(
        "%s does not change the subscription",
        async (type) => {
          const res = await POST(webhook(rcEvent({ store, type })))
          expect(res.status).toBe(200)
          expect(h.supabase!._queryBuilder.upsert).not.toHaveBeenCalled()
          expect(h.supabase!._queryBuilder.update).not.toHaveBeenCalled()
        },
      )

      it("does not grant without the pro entitlement", async () => {
        await POST(webhook(rcEvent({ store, entitlement_ids: ["something_else"] })))
        expect(h.supabase!._queryBuilder.upsert).not.toHaveBeenCalled()
      })

      it("does not grant with a forged or missing signature", async () => {
        await POST(webhook(rcEvent({ store, subscriber_attributes: { savvo_sig: { value: "forged" } } })))
        await POST(webhook(rcEvent({ store, subscriber_attributes: null })))
        expect(h.supabase!._queryBuilder.upsert).not.toHaveBeenCalled()
      })
    })
  }

  it("fails closed in production when the attribute secret is unset", async () => {
    vi.stubEnv("REVENUECAT_ATTRIBUTE_SECRET", "")
    vi.stubEnv("NODE_ENV", "production")
    const res = await POST(webhook(rcEvent({ store: "PLAY_STORE" })))
    expect(res.status).toBe(200)
    expect(h.supabase!._queryBuilder.upsert).not.toHaveBeenCalled()
  })

  it("returns 500 so RevenueCat retries when the DB write fails", async () => {
    h.supabase = createMockSupabase({ queryResult: { data: null, error: { message: "boom" } } })
    const res = await POST(webhook(rcEvent({ store: "PLAY_STORE" })))
    expect(res.status).toBe(500)
  })

  it("rejects a non-UUID app_user_id", async () => {
    const res = await POST(webhook(rcEvent({ app_user_id: "$RCAnonymousID:abc" })))
    expect(res.status).toBe(400)
  })
})
