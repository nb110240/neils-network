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

import { POST } from "@/app/api/contacts/merge/undo/route"

const MERGE_LOG_ID = "11111111-1111-4111-8111-111111111111"
const KEPT_ID = "22222222-2222-4222-8222-222222222222"
const REMOVED_ID = "33333333-3333-4333-8333-333333333333"
const URL = "http://localhost/api/contacts/merge/undo"

describe("POST /api/contacts/merge/undo", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, { mergeLogId: MERGE_LOG_ID }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, { mergeLogId: MERGE_LOG_ID }))
    expect(res.status).toBe(429)
  })

  it("rejects a non-UUID merge log id with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { mergeLogId: "not-a-uuid" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when the merge log is not found", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await POST(postRequest(URL, { mergeLogId: MERGE_LOG_ID }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/not found/i)
  })

  it("returns 400 when the merge was already undone", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: {
          id: MERGE_LOG_ID,
          user_id: "u1",
          kept_contact_id: KEPT_ID,
          removed_contact_id: REMOVED_ID,
          kept_before: {},
          removed_before: {},
          undone_at: "2026-05-01T00:00:00Z",
        },
        error: null,
      },
    })
    const res = await POST(postRequest(URL, { mergeLogId: MERGE_LOG_ID }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/already undone/i)
  })

  it("undoes a merge on the happy path", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: {
          id: MERGE_LOG_ID,
          user_id: "u1",
          kept_contact_id: KEPT_ID,
          removed_contact_id: REMOVED_ID,
          kept_before: { email: "keep@example.com", raw_note: "n" },
          removed_before: { email: "removed@example.com", raw_note: "m" },
          moved_activity_ids: [],
          moved_tag_ids: [],
          undone_at: null,
        },
        error: null,
      },
    })
    const res = await POST(postRequest(URL, { mergeLogId: MERGE_LOG_ID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it("returns 500 when the request body is invalid JSON", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const req = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad",
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
