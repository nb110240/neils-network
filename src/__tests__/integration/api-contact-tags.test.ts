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

import { PUT } from "@/app/api/contacts/[id]/tags/route"

const ID = "11111111-1111-4111-8111-111111111111"
const TAG_ID = "33333333-3333-4333-8333-333333333333"
const URL = `http://localhost/api/contacts/${ID}/tags`
const ctx = { params: Promise.resolve({ id: ID }) }
const badCtx = { params: Promise.resolve({ id: "not-a-uuid" }) }

describe("PUT /api/contacts/[id]/tags", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await PUT(putRequest(URL, { tagIds: [] }), badCtx)
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await PUT(putRequest(URL, { tagIds: [] }), ctx)
    expect(res.status).toBe(401)
  })

  it("returns 404 when the contact is not found", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await PUT(putRequest(URL, { tagIds: [] }), ctx)
    expect(res.status).toBe(404)
  })

  it("rejects a non-array tagIds with 400", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID }, error: null },
    })
    const res = await PUT(putRequest(URL, { tagIds: "not-an-array" }), ctx)
    expect(res.status).toBe(400)
  })

  it("rejects a tagId that is not a valid UUID with 400", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID }, error: null },
    })
    const res = await PUT(putRequest(URL, { tagIds: ["not-a-uuid"] }), ctx)
    expect(res.status).toBe(400)
  })

  it("sets tags on a contact for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: [{ tag_id: TAG_ID, tags: { id: TAG_ID, name: "VIP" } }],
        error: null,
      },
    })
    const res = await PUT(putRequest(URL, { tagIds: [TAG_ID] }), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.tags).toBeDefined()
  })

  it("clears all tags when an empty array is provided", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [], error: null },
    })
    const res = await PUT(putRequest(URL, { tagIds: [] }), ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.tags).toEqual([])
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await PUT(putRequest(URL, { tagIds: [] }), ctx)
    expect(res.status).toBe(429)
  })
})
