import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { putRequest } from "../helpers/mock-request"

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
}))

import { GET, PUT } from "@/app/api/settings/notifications/route"

const URL = "http://localhost/api/settings/notifications"

describe("PUT /api/settings/notifications", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
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

  it("rejects daily digests for free users", async () => {
    h.plan = "free"
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })

    const res = await PUT(putRequest(URL, { digest_frequency: "daily" }))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Daily digests are a Pro feature" })
  })

  it("allows daily digests for team users", async () => {
    h.plan = "team"
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })

    const res = await PUT(putRequest(URL, { digest_frequency: "daily" }))

    expect(res.status).toBe(200)
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

describe("GET /api/settings/notifications", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
  })

  it("normalizes a stale daily preference to weekly for free users", async () => {
    h.plan = "free"
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { digest_frequency: "daily" }, error: null },
    })

    const res = await GET()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      digest_frequency: "weekly",
      can_use_daily: false,
      push_enabled: true,
    })
  })

  it.each(["pro", "team"] as const)("reports daily eligibility for %s users", async (plan) => {
    h.plan = plan
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { digest_frequency: "daily" }, error: null },
    })

    const res = await GET()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      digest_frequency: "daily",
      can_use_daily: true,
      push_enabled: true,
    })
  })
})

describe("push notification preference", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
  })

  it("reports push turned off when the user switched it off", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { digest_frequency: "weekly", push_enabled: false }, error: null },
    })
    const res = await GET()
    expect((await res.json()).push_enabled).toBe(false)
  })

  it("saves push alone without switching a new account to daily digests", async () => {
    // Regression guard: digest_frequency defaults to "daily" in the table, so
    // a push-only upsert that omits it would quietly start daily emails.
    h.supabase = createMockSupabase({ authUser: { id: "u1" }, queryResult: { data: null, error: null } })
    const res = await PUT(putRequest(URL, { push_enabled: false }))
    expect(res.status).toBe(200)
    expect(h.supabase._queryBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", push_enabled: false, digest_frequency: "weekly" }),
      { onConflict: "user_id" }
    )
    await expect(res.json()).resolves.toEqual({ digest_frequency: "weekly", push_enabled: false })
  })

  it("keeps the saved digest frequency when only push changes", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { digest_frequency: "never" }, error: null },
    })
    await PUT(putRequest(URL, { push_enabled: true }))
    expect(h.supabase._queryBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ push_enabled: true, digest_frequency: "never" }),
      { onConflict: "user_id" }
    )
  })

  it("rejects a non-boolean push setting", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await PUT(putRequest(URL, { push_enabled: "yes" }))
    expect(res.status).toBe(400)
  })
})
