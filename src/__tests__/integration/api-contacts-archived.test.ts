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

import { POST, DELETE } from "@/app/api/contacts/archived/route"

const ID = "11111111-1111-4111-8111-111111111111"
const URL = "http://localhost/api/contacts/archived"

// DELETE on this route reads a JSON body, so build a DELETE request with one.
function deleteWithBody(body: unknown) {
  return buildRequest({ method: "DELETE", url: URL, body })
}

describe("POST /api/contacts/archived (restore)", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, { contactId: ID }))
    expect(res.status).toBe(401)
  })

  it("rejects a missing contactId with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, {}))
    expect(res.status).toBe(400)
  })

  it("restores an archived contact for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ID, archived_at: null }, error: null },
    })
    const res = await POST(postRequest(URL, { contactId: ID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it("returns 500 when the restore update fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db error" } },
    })
    const res = await POST(postRequest(URL, { contactId: ID }))
    expect(res.status).toBe(500)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, { contactId: ID }))
    expect(res.status).toBe(429)
  })
})

describe("DELETE /api/contacts/archived (permanent delete)", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await DELETE(deleteWithBody({ contactId: ID }))
    expect(res.status).toBe(401)
  })

  it("rejects a missing contactId with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await DELETE(deleteWithBody({}))
    expect(res.status).toBe(400)
  })

  it("permanently deletes a contact for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await DELETE(deleteWithBody({ contactId: ID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it("returns 500 when the permanent delete fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db error" } },
    })
    const res = await DELETE(deleteWithBody({ contactId: ID }))
    expect(res.status).toBe(500)
  })
})
