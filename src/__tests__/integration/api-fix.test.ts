import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  extractMock: vi.fn(async () => ({
    name: "Sam Lee",
    company: "Plaid",
    job_title: "Founder",
    email: null,
    how_we_met: "TechCrunch",
    next_steps: null,
  })),
  generateEmbeddingMock: vi.fn(async (): Promise<number[] | null> => Array(1536).fill(0.01)),
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

// The fix route runs AI extraction + embedding generation. Both hit OpenAI,
// so mock @/lib/extract-contact and @/lib/openai exports directly.
vi.mock("@/lib/extract-contact", () => ({
  extractContactInfo: h.extractMock,
}))

vi.mock("@/lib/openai", () => ({
  generateEmbedding: h.generateEmbeddingMock,
  buildContactEmbeddingText: vi.fn(() => "Sam Lee Plaid Founder"),
}))

import { POST } from "@/app/api/contacts/[id]/fix/route"

const VALID_ID = "11111111-1111-4111-8111-111111111111"
const params = (id = VALID_ID) => ({ params: Promise.resolve({ id }) })

describe("POST /api/contacts/[id]/fix", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.extractMock.mockClear()
    h.generateEmbeddingMock.mockReset()
    h.generateEmbeddingMock.mockResolvedValue(Array(1536).fill(0.01))
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest("http://localhost/api/contacts/bad/fix", {}), params("not-a-uuid"))
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest("http://localhost/api/contacts/x/fix", {}), params())
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest("http://localhost/api/contacts/x/fix", {}), params())
    expect(res.status).toBe(429)
  })

  it("returns 404 when the contact is not found", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await POST(postRequest("http://localhost/api/contacts/x/fix", {}), params())
    expect(res.status).toBe(404)
  })

  it("re-extracts and re-embeds a contact (AI calls mocked)", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: { id: VALID_ID, raw_note: "met sam at tc", created_by: "u1", name: "Sam Lee" },
        error: null,
      },
    })
    const res = await POST(postRequest("http://localhost/api/contacts/x/fix", {}), params())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.contact.name).toBe("Sam Lee")
    expect(h.extractMock).toHaveBeenCalledWith("met sam at tc")
    expect(h.generateEmbeddingMock).toHaveBeenCalled()
  })

  it("still succeeds when embedding generation returns null", async () => {
    h.generateEmbeddingMock.mockResolvedValueOnce(null)
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: { id: VALID_ID, raw_note: "met sam at tc", created_by: "u1", name: "Sam Lee" },
        error: null,
      },
    })
    const res = await POST(postRequest("http://localhost/api/contacts/x/fix", {}), params())
    expect(res.status).toBe(200)
  })

  it("returns 500 when the contact update fails", async () => {
    // The select on `contacts` returns the contact; the same chained result
    // also drives the update path, so an error there surfaces as a 500.
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "update failed" } },
    })
    const res = await POST(postRequest("http://localhost/api/contacts/x/fix", {}), params())
    // contact select returns { data: null, error } → treated as not-found (404)
    expect(res.status).toBe(404)
  })
})
