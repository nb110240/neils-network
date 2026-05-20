import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
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

// The embed route calls generateEmbedding, which hits the OpenAI embeddings
// API. Mock the @/lib/openai exports so no external call happens.
vi.mock("@/lib/openai", () => ({
  generateEmbedding: h.generateEmbeddingMock,
  buildContactEmbeddingText: vi.fn(() => "Sam Lee Plaid Founder"),
}))

import { POST } from "@/app/api/contacts/[id]/embed/route"

const VALID_ID = "11111111-1111-4111-8111-111111111111"
const params = (id = VALID_ID) => ({ params: Promise.resolve({ id }) })

describe("POST /api/contacts/[id]/embed", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.generateEmbeddingMock.mockReset()
    h.generateEmbeddingMock.mockResolvedValue(Array(1536).fill(0.01))
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest("http://localhost/api/contacts/bad/embed", {}), params("not-a-uuid"))
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest("http://localhost/api/contacts/x/embed", {}), params())
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest("http://localhost/api/contacts/x/embed", {}), params())
    expect(res.status).toBe(429)
  })

  it("returns 404 when the contact is not found", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: null },
    })
    const res = await POST(postRequest("http://localhost/api/contacts/x/embed", {}), params())
    expect(res.status).toBe(404)
  })

  it("regenerates the embedding for a contact (AI call mocked)", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: {
          id: VALID_ID,
          name: "Sam Lee",
          company: "Plaid",
          job_title: "Founder",
          email: null,
          how_we_met: "TechCrunch",
          next_steps: null,
          raw_note: "met sam at tc",
          created_by: "u1",
        },
        error: null,
      },
    })
    const res = await POST(postRequest("http://localhost/api/contacts/x/embed", {}), params())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.status).toBe("complete")
    expect(h.generateEmbeddingMock).toHaveBeenCalled()
  })

  it("reports a failed status when embedding generation returns null", async () => {
    h.generateEmbeddingMock.mockResolvedValueOnce(null)
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: {
          id: VALID_ID,
          name: "Sam Lee",
          company: "Plaid",
          raw_note: "met sam at tc",
          created_by: "u1",
        },
        error: null,
      },
    })
    const res = await POST(postRequest("http://localhost/api/contacts/x/embed", {}), params())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("failed")
  })
})
