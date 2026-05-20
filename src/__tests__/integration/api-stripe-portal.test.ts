import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"

// ─── Route mocks ───
// vi.mock is hoisted above imports; the factories read from a hoisted holder
// so each test can swap the Supabase client, rate-limit verdict, Stripe behaviour
// and the user's existing subscription.
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  subscription: null as { stripe_customer_id?: string } | null,
  stripeError: null as Error | null,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.supabase),
  createServiceClient: vi.fn(async () => h.supabase),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({
    success: h.rateLimitSuccess,
    limit: 100,
    remaining: 99,
    reset: Date.now() + 60_000,
  })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    billingPortal: {
      sessions: {
        create: vi.fn(async () => {
          if (h.stripeError) throw h.stripeError
          return { url: "https://stripe.test/session" }
        }),
      },
    },
  })),
}))

vi.mock("@/lib/subscription", () => ({
  getUserSubscription: vi.fn(async () => h.subscription),
}))

import { POST } from "@/app/api/stripe/portal/route"

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.subscription = null
    h.stripeError = null
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.rateLimitSuccess = false
    const res = await POST()
    expect(res.status).toBe(429)
  })

  it("returns 404 when the user has no Stripe customer", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.subscription = null
    const res = await POST()
    expect(res.status).toBe(404)
  })

  it("creates a billing portal session for a subscribed user", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.subscription = { stripe_customer_id: "cus_existing" }
    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe("https://stripe.test/session")
  })

  it("returns 500 when the Stripe SDK throws", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.subscription = { stripe_customer_id: "cus_existing" }
    h.stripeError = new Error("Stripe down")
    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain("Failed to create portal session")
  })
})
