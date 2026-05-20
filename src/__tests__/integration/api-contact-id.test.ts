import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { putRequest, deleteRequest } from "../helpers/mock-request"

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

import { PUT, DELETE } from "@/app/api/contacts/[id]/route"

const ID = "11111111-1111-4111-8111-111111111111"
const URL = `http://localhost/api/contacts/${ID}`
const ctx = { params: Promise.resolve({ id: ID }) }
const badCtx = { params: Promise.resolve({ id: "not-a-uuid" }) }

describe("PUT /api/contacts/[id]", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await PUT(putRequest(URL, { name: "Ada" }), badCtx)
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await PUT(putRequest(URL, { name: "Ada" }), ctx)
    expect(res.status).toBe(401)
  })

  it("rejects an invalid email with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await PUT(putRequest(URL, { email: "not-an-email" }), ctx)
    expect(res.status).toBe(400)
  })

  it("rejects an out-of-range cadence_days with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await PUT(putRequest(URL, { cadence_days: 9999 }), ctx)
    expect(res.status).toBe(400)
  })

  it("updates a contact for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: { id: ID, name: "Ada", created_at: "2026-01-01", next_due_date: null },
        error: null,
      },
    })
    const res = await PUT(putRequest(URL, { name: "Ada" }), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.contact.name).toBe("Ada")
  })

  it("returns 500 when the update fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db error" } },
    })
    const res = await PUT(putRequest(URL, { name: "Ada" }), ctx)
    expect(res.status).toBe(500)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await PUT(putRequest(URL, { name: "Ada" }), ctx)
    expect(res.status).toBe(429)
  })
})

describe("DELETE /api/contacts/[id]", () => {
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

  it("soft-deletes (archives) a contact for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await DELETE(deleteRequest(URL), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it("returns 500 when the archive update fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db error" } },
    })
    const res = await DELETE(deleteRequest(URL), ctx)
    expect(res.status).toBe(500)
  })
})
