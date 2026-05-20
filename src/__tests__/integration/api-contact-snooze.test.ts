import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest, deleteRequest } from "../helpers/mock-request"

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

import { POST, DELETE } from "@/app/api/contacts/[id]/snooze/route"

const ID = "11111111-1111-4111-8111-111111111111"
const URL = `http://localhost/api/contacts/${ID}/snooze`
const ctx = { params: Promise.resolve({ id: ID }) }
const badCtx = { params: Promise.resolve({ id: "not-a-uuid" }) }

describe("POST /api/contacts/[id]/snooze", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { days: 7 }), badCtx)
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, { days: 7 }), ctx)
    expect(res.status).toBe(401)
  })

  it("rejects a body with neither days nor until with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, {}), ctx)
    expect(res.status).toBe(400)
  })

  it("rejects an out-of-range days value with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { days: 999 }), ctx)
    expect(res.status).toBe(400)
  })

  it("snoozes a contact by days for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID, snoozed_until: "2026-05-27" }, error: null },
    })
    const res = await POST(postRequest(URL, { days: 7 }), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.snoozed_until).toBeDefined()
  })

  it("snoozes a contact with an explicit until date", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID, snoozed_until: "2026-06-01" }, error: null },
    })
    const res = await POST(postRequest(URL, { until: "2026-06-01" }), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.snoozed_until).toBe("2026-06-01")
  })

  it("returns 500 when the snooze update fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db error" } },
    })
    const res = await POST(postRequest(URL, { days: 7 }), ctx)
    expect(res.status).toBe(500)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, { days: 7 }), ctx)
    expect(res.status).toBe(429)
  })
})

describe("DELETE /api/contacts/[id]/snooze", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await DELETE(deleteRequest(URL), badCtx)
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await DELETE(deleteRequest(URL), ctx)
    expect(res.status).toBe(401)
  })

  it("unsnoozes a contact for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID, snoozed_until: null }, error: null },
    })
    const res = await DELETE(deleteRequest(URL), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.contact).toBeDefined()
  })

  it("returns 500 when the unsnooze update fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db error" } },
    })
    const res = await DELETE(deleteRequest(URL), ctx)
    expect(res.status).toBe(500)
  })
})
