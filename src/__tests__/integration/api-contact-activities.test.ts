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

import { POST, DELETE } from "@/app/api/contacts/[id]/activities/route"

const ID = "11111111-1111-4111-8111-111111111111"
const ACTIVITY_ID = "22222222-2222-4222-8222-222222222222"
const URL = `http://localhost/api/contacts/${ID}/activities`
const ctx = { params: Promise.resolve({ id: ID }) }
const badCtx = { params: Promise.resolve({ id: "not-a-uuid" }) }

const validActivity = {
  type: "note",
  content: "Caught up over coffee",
  occurred_at: "2026-05-01",
}

describe("POST /api/contacts/[id]/activities", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, validActivity), badCtx)
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, validActivity), ctx)
    expect(res.status).toBe(401)
  })

  it("returns 404 when the contact is not found", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await POST(postRequest(URL, validActivity), ctx)
    expect(res.status).toBe(404)
  })

  it("rejects an invalid activity type with 400", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID, created_at: "2026-01-01" }, error: null },
    })
    const res = await POST(postRequest(URL, { ...validActivity, type: "bogus" }), ctx)
    expect(res.status).toBe(400)
  })

  it("rejects empty activity content with 400", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID, created_at: "2026-01-01" }, error: null },
    })
    const res = await POST(postRequest(URL, { ...validActivity, content: "" }), ctx)
    expect(res.status).toBe(400)
  })

  it("creates an activity and returns 201", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: { id: ID, created_at: "2026-01-01", last_contact_date: null },
        error: null,
      },
    })
    const res = await POST(postRequest(URL, validActivity), ctx)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.activity).toBeDefined()
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, validActivity), ctx)
    expect(res.status).toBe(429)
  })
})

describe("DELETE /api/contacts/[id]/activities", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await DELETE(deleteRequest(`${URL}?activityId=${ACTIVITY_ID}`), badCtx)
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await DELETE(deleteRequest(`${URL}?activityId=${ACTIVITY_ID}`), ctx)
    expect(res.status).toBe(401)
  })

  it("returns 404 when the contact is not found", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await DELETE(deleteRequest(`${URL}?activityId=${ACTIVITY_ID}`), ctx)
    expect(res.status).toBe(404)
  })

  it("rejects a missing activityId with 400", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID }, error: null },
    })
    const res = await DELETE(deleteRequest(URL), ctx)
    expect(res.status).toBe(400)
  })

  it("rejects an invalid activityId with 400", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID }, error: null },
    })
    const res = await DELETE(deleteRequest(`${URL}?activityId=not-a-uuid`), ctx)
    expect(res.status).toBe(400)
  })

  it("deletes an activity for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID }, error: null },
    })
    const res = await DELETE(deleteRequest(`${URL}?activityId=${ACTIVITY_ID}`), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
