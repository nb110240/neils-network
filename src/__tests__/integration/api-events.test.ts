import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest, buildRequest } from "../helpers/mock-request"

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

import { POST, PATCH } from "@/app/api/events/route"

const URL = "http://localhost/api/events"
const EVENT_ID = "11111111-1111-4111-8111-111111111111"

function patchRequest(body: unknown) {
  return buildRequest({ method: "PATCH", url: URL, body })
}

describe("POST /api/events", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, { name: "SaaStr 2026" }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, { name: "SaaStr 2026" }))
    expect(res.status).toBe(429)
  })

  it("rejects an empty event name with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { name: "   " }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/name is required/i)
  })

  it("rejects an out-of-range duration with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { name: "SaaStr 2026", duration_hours: 100 }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/duration/i)
  })

  it("creates an event on the happy path", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: { id: EVENT_ID, name: "SaaStr 2026", is_active: true },
        error: null,
      },
    })
    const res = await POST(postRequest(URL, { name: "SaaStr 2026", duration_hours: 6 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.event.name).toBe("SaaStr 2026")
  })

  it("returns 500 when the insert fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db down" } },
    })
    const res = await POST(postRequest(URL, { name: "SaaStr 2026" }))
    expect(res.status).toBe(500)
  })
})

describe("PATCH /api/events", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await PATCH(patchRequest({ eventId: EVENT_ID }))
    expect(res.status).toBe(401)
  })

  it("rejects a non-UUID event id with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await PATCH(patchRequest({ eventId: "not-a-uuid" }))
    expect(res.status).toBe(400)
  })

  it("deactivates an event on the happy path", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: { id: EVENT_ID, is_active: false },
        error: null,
      },
    })
    const res = await PATCH(patchRequest({ eventId: EVENT_ID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.event.is_active).toBe(false)
  })

  it("returns 500 when the update fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db down" } },
    })
    const res = await PATCH(patchRequest({ eventId: EVENT_ID }))
    expect(res.status).toBe(500)
  })
})
