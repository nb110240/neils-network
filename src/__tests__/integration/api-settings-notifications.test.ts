import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { putRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
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

import { PUT } from "@/app/api/settings/notifications/route"

const URL = "http://localhost/api/settings/notifications"

describe("PUT /api/settings/notifications", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await PUT(putRequest(URL, { digest_frequency: "daily" }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await PUT(putRequest(URL, { digest_frequency: "daily" }))
    expect(res.status).toBe(429)
  })

  it("rejects an invalid digest frequency with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await PUT(putRequest(URL, { digest_frequency: "hourly" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/digest_frequency/i)
  })

  it("rejects a missing digest frequency with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await PUT(putRequest(URL, {}))
    expect(res.status).toBe(400)
  })

  it("saves a valid digest frequency on the happy path", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await PUT(putRequest(URL, { digest_frequency: "weekly" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.digest_frequency).toBe("weekly")
  })

  it("returns 500 when the upsert fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db down" } },
    })
    const res = await PUT(putRequest(URL, { digest_frequency: "never" }))
    expect(res.status).toBe(500)
  })
})
