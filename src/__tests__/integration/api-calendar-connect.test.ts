import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

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

import { GET, POST } from "@/app/api/calendar/connect/route"

const URL = "http://localhost/api/calendar/connect"

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

  describe("POST (exchange code for tokens)", () => {
    it("returns 400 when code or state is missing", async () => {
      h.supabase = createMockSupabase({ authUser: { id: "u1" } })
      const res = await POST(postRequest(URL, { code: "abc" }))
      expect(res.status).toBe(400)
    })

    it("returns 403 when state userId does not match the authenticated user (IDOR)", async () => {
      h.supabase = createMockSupabase({ authUser: { id: "u1" } })
      const res = await POST(postRequest(URL, { code: "abc", state: "someone-else" }))
      expect(res.status).toBe(403)
    })

    it("exchanges the code and upserts the integration on the happy path", async () => {
      h.supabase = createMockSupabase({ authUser: { id: "u1" } })
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            access_token: "ya29.token",
            refresh_token: "1//refresh",
            expires_in: 3600,
          }),
        }))
      )
      const res = await POST(postRequest(URL, { code: "good-code", state: "u1" }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
    })

    it("returns 500 when Google token exchange fails", async () => {
      h.supabase = createMockSupabase({ authUser: { id: "u1" } })
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          text: async () => "invalid_grant",
        }))
      )
      const res = await POST(postRequest(URL, { code: "bad-code", state: "u1" }))
      expect(res.status).toBe(500)
    })

    it("allows the exchange when the caller has no session (callback path)", async () => {
      // POST is also used by the OAuth callback where the request may not
      // carry a user session — when user is null the IDOR check is skipped.
      h.supabase = createMockSupabase({ authUser: null })
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ access_token: "ya29.token", expires_in: 3600 }),
        }))
      )
      const res = await POST(postRequest(URL, { code: "good-code", state: "u1" }))
      expect(res.status).toBe(200)
    })
  })
})
