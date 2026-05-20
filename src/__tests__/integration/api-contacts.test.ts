import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  extracted: {} as Record<string, unknown>,
  contactLimitAllowed: true,
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

// extract-contact issues a real fetch() to OpenAI — mock it.
vi.mock("@/lib/extract-contact", () => ({
  extractContactInfo: vi.fn(async () => h.extracted),
}))

// openai.generateEmbedding hits the network — mock it.
vi.mock("@/lib/openai", () => ({
  generateEmbedding: vi.fn(async () => null),
  buildContactEmbeddingText: vi.fn(() => "embedding text"),
}))

// subscription gates the create path on the plan limit.
vi.mock("@/lib/subscription", () => ({
  checkContactLimit: vi.fn(async () => ({
    allowed: h.contactLimitAllowed,
    plan: "free",
    count: 0,
    limit: 25,
  })),
}))

import { POST } from "@/app/api/contacts/route"

const URL = "http://localhost/api/contacts"

describe("POST /api/contacts", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.contactLimitAllowed = true
    h.extracted = { name: "Ada Lovelace", email: "ada@example.com" }
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, { raw_note: "Met Ada at a conference" }))
    expect(res.status).toBe(401)
  })

  it("rejects a missing raw_note with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, {}))
    expect(res.status).toBe(400)
  })

  it("rejects a too-short raw_note with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { raw_note: "hi" }))
    expect(res.status).toBe(400)
  })

  it("rejects a raw_note over 20,000 characters with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { raw_note: "x".repeat(20001) }))
    expect(res.status).toBe(400)
  })

  it("creates a contact for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [], error: null },
    })
    const res = await POST(postRequest(URL, { raw_note: "Met Ada at a conference" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, { raw_note: "Met Ada at a conference" }))
    expect(res.status).toBe(429)
  })

  it("returns 403 when the contact limit is reached", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [], error: null },
    })
    h.contactLimitAllowed = false
    const res = await POST(postRequest(URL, { raw_note: "Met Ada at a conference" }))
    expect(res.status).toBe(403)
  })

  it("returns 500 when the contact insert fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db down" } },
    })
    const res = await POST(postRequest(URL, { raw_note: "Met Ada at a conference" }))
    expect(res.status).toBe(500)
  })
})
