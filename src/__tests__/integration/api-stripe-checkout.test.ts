import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
// vi.mock is hoisted above imports; the factories read from a hoisted holder
// so each test can swap the Supabase client, rate-limit verdict, Stripe behaviour
// and the user's existing subscription.
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  priceActive: true,
  subscription: null as { stripe_customer_id?: string; stripe_subscription_id?: string; status?: string } | null,
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
  getStripe: vi.fn(() => {
    if (h.stripeError) throw h.stripeError
    return {
      prices: {
        retrieve: vi.fn(async () => ({ id: "price_x", active: h.priceActive })),
      },
      customers: {
        create: vi.fn(async () => ({ id: "cus_new" })),
      },
      checkout: {
        sessions: {
          create: vi.fn(async () => ({ url: "https://stripe.test/session" })),
        },
      },
    }
  }),
  STRIPE_PRICE_MONTHLY: "price_monthly",
  STRIPE_PRICE_YEARLY: "price_yearly",
}))

vi.mock("@/lib/subscription", () => ({
  getUserSubscription: vi.fn(async () => h.subscription),
}))

import { POST } from "@/app/api/stripe/checkout/route"

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.priceActive = true
    h.subscription = null
    h.stripeError = null
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest("http://localhost/api/stripe/checkout", {}))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest("http://localhost/api/stripe/checkout", {}))
    expect(res.status).toBe(429)
  })

  it("creates a checkout session for an authenticated user (monthly)", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    const res = await POST(postRequest("http://localhost/api/stripe/checkout", { billing: "monthly" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe("https://stripe.test/session")
  })

  it("creates a checkout session for the yearly plan", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    const res = await POST(postRequest("http://localhost/api/stripe/checkout", { billing: "yearly" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe("https://stripe.test/session")
  })

  it("reuses an existing Stripe customer when one exists", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.subscription = { stripe_customer_id: "cus_existing" }
    const res = await POST(postRequest("http://localhost/api/stripe/checkout", {}))
    expect(res.status).toBe(200)
  })

  it.each(["active", "past_due"])("refuses a second checkout while a %s Stripe subscription exists", async (status) => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.subscription = { stripe_customer_id: "cus_existing", stripe_subscription_id: "sub_1", status }
    const res = await POST(postRequest("http://localhost/api/stripe/checkout", {}))
    expect(res.status).toBe(409)
  })

  it("allows checkout again after the subscription was canceled", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.subscription = { stripe_customer_id: "cus_existing", stripe_subscription_id: "sub_1", status: "canceled" }
    const res = await POST(postRequest("http://localhost/api/stripe/checkout", {}))
    expect(res.status).toBe(200)
  })

  it("returns 500 when the configured price is inactive", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.priceActive = false
    const res = await POST(postRequest("http://localhost/api/stripe/checkout", {}))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain("Invalid or inactive price")
  })

  it("returns 500 when the Stripe SDK throws", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@test.com" } })
    h.stripeError = new Error("Stripe down")
    const res = await POST(postRequest("http://localhost/api/stripe/checkout", {}))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain("Failed to create checkout session")
  })
})
