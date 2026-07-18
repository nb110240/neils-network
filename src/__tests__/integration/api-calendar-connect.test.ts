import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  plan: "pro" as "free" | "pro" | "team",
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

vi.mock("@/lib/subscription", () => ({
  getUserPlan: vi.fn(async () => h.plan),
  getPlanLimits: vi.fn((plan: string) => ({
    maxContacts: plan === "free" ? 50 : Infinity,
    canImport: plan !== "free",
    canCalendarSync: plan !== "free",
  })),
}))

import { GET } from "@/app/api/calendar/connect/route"

describe("/api/calendar/connect", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
    process.env.OAUTH_STATE_SECRET = "test-oauth-secret"
    process.env.GOOGLE_CLIENT_ID = "test-client-id"
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret"
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001"
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.unstubAllGlobals()
  })

  describe("GET (start OAuth flow)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      h.supabase = createMockSupabase({ authUser: null })
      const res = await GET()
      expect(res.status).toBe(401)
    })

    it("returns 403 for free-plan users (Pro-gated feature)", async () => {
      h.supabase = createMockSupabase({ authUser: { id: "u1" } })
      h.plan = "free"
      const res = await GET()
      expect(res.status).toBe(403)
    })

    it("returns a Google OAuth URL for a Pro user", async () => {
      h.supabase = createMockSupabase({ authUser: { id: "u1" } })
      const res = await GET()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.url).toContain("https://accounts.google.com/o/oauth2/v2/auth")
      expect(json.url).toContain("client_id=test-client-id")
      // state is HMAC-signed with the user id
      expect(json.url).toContain("state=u1.")
    })

    it("returns 500 when Google OAuth is not configured", async () => {
      h.supabase = createMockSupabase({ authUser: { id: "u1" } })
      delete process.env.GOOGLE_CLIENT_ID
      const res = await GET()
      expect(res.status).toBe(500)
    })
  })
})
