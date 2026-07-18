import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

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

import { POST } from "@/app/api/contacts/merge/route"

const KEEP_ID = "11111111-1111-4111-8111-111111111111"
const REMOVE_ID = "22222222-2222-4222-8222-222222222222"
const URL = "http://localhost/api/contacts/merge"

describe("POST /api/contacts/merge", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, { keepId: KEEP_ID, removeId: REMOVE_ID }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, { keepId: KEEP_ID, removeId: REMOVE_ID }))
    expect(res.status).toBe(429)
  })

  it("rejects non-UUID contact IDs with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { keepId: "not-a-uuid", removeId: "also-bad" }))
    expect(res.status).toBe(400)
  })

  it("rejects merging a contact with itself with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { keepId: KEEP_ID, removeId: KEEP_ID }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/itself/i)
  })

  it("returns 400 when one or both contacts are not found", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      rpcResult: { data: null, error: { message: "One or both contacts not found" } },
    })
    const res = await POST(postRequest(URL, { keepId: KEEP_ID, removeId: REMOVE_ID }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/not found/i)
  })

  it("merges two contacts on the happy path", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      rpcResult: {
        data: {
          keepId: KEEP_ID,
          removeId: REMOVE_ID,
          mergeLogId: "33333333-3333-4333-8333-333333333333",
          fieldsMerged: ["email"],
        },
        error: null,
      },
    })
    const res = await POST(postRequest(URL, { keepId: KEEP_ID, removeId: REMOVE_ID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.keepId).toBe(KEEP_ID)
    expect(json.removeId).toBe(REMOVE_ID)
  })

  it("rejects an invalid bulk merge payload with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { pairs: [] }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/bulk merge/i)
  })

  it("processes a valid bulk merge payload", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      rpcResult: {
        data: {
          keepId: KEEP_ID,
          removeId: REMOVE_ID,
          mergeLogId: "33333333-3333-4333-8333-333333333333",
          fieldsMerged: [],
        },
        error: null,
      },
    })
    const res = await POST(
      postRequest(URL, { pairs: [{ keepId: KEEP_ID, removeId: REMOVE_ID }] })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.merged)).toBe(true)
    expect(Array.isArray(json.errors)).toBe(true)
  })

  it("returns 500 when the request body is invalid JSON", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const req = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
