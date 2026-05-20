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

import { POST } from "@/app/api/contacts/duplicates/dismiss/route"

const URL = "http://localhost/api/contacts/duplicates/dismiss"
const ID_A = "11111111-1111-4111-8111-111111111111"
const ID_B = "22222222-2222-4222-8222-222222222222"
const ID_C = "33333333-3333-4333-8333-333333333333"

describe("POST /api/contacts/duplicates/dismiss", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, { contactIds: [ID_A, ID_B] }))
    expect(res.status).toBe(401)
  })

  it("rejects fewer than two contact IDs with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { contactIds: [ID_A] }))
    expect(res.status).toBe(400)
  })

  it("rejects non-UUID contact IDs with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { contactIds: ["not-a-uuid", "also-bad"] }))
    expect(res.status).toBe(400)
  })

  it("rejects more than 20 contact IDs with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const ids = Array.from({ length: 21 }, (_, i) =>
      `${String(i + 1).padStart(8, "0")}-1111-4111-8111-111111111111`
    )
    const res = await POST(postRequest(URL, { contactIds: ids }))
    expect(res.status).toBe(400)
  })

  it("dismisses a duplicate pair for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await POST(postRequest(URL, { contactIds: [ID_A, ID_B] }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.dismissed).toBe(1)
  })

  it("dismisses all pairwise combinations for three contacts", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await POST(postRequest(URL, { contactIds: [ID_A, ID_B, ID_C] }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.dismissed).toBe(3)
  })

  it("returns 500 when the upsert fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db error" } },
    })
    const res = await POST(postRequest(URL, { contactIds: [ID_A, ID_B] }))
    expect(res.status).toBe(500)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, { contactIds: [ID_A, ID_B] }))
    expect(res.status).toBe(429)
  })
})
