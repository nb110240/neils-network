import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  semanticAllowed: true,
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

// The search route generates a query embedding via @/lib/openai (OpenAI
// embeddings API). Mock it so no external call happens.
vi.mock("@/lib/openai", () => ({
  generateEmbedding: h.generateEmbeddingMock,
}))

// Semantic search is quota-gated via @/lib/subscription. Mock it permissively.
vi.mock("@/lib/subscription", () => ({
  checkSemanticSearchLimit: vi.fn(async () => ({
    allowed: h.semanticAllowed,
    used: 0,
    limit: 100,
    plan: "pro",
  })),
  recordSemanticSearch: vi.fn(async () => {}),
}))

import { POST } from "@/app/api/search/route"

describe("POST /api/search", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.semanticAllowed = true
    h.generateEmbeddingMock.mockClear()
    h.generateEmbeddingMock.mockResolvedValue(Array(1536).fill(0.01))
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest("http://localhost/api/search", { query: "fintech" }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest("http://localhost/api/search", { query: "fintech" }))
    expect(res.status).toBe(429)
  })

  it("rejects an empty query with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest("http://localhost/api/search", { query: "" }))
    expect(res.status).toBe(400)
  })

  it("rejects a missing query with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest("http://localhost/api/search", {}))
    expect(res.status).toBe(400)
  })

  it("runs a hybrid search with the embedding call mocked", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: [
          {
            id: "c1",
            name: "Sam Lee",
            company: "Plaid",
            last_contact_date: "2026-04-01",
            created_at: "2026-01-01",
          },
        ],
        error: null,
      },
      rpcResult: {
        data: [
          {
            id: "c1",
            name: "Sam Lee",
            company: "Plaid",
            last_contact_date: "2026-04-01",
            created_at: "2026-01-01",
            similarity: 0.8,
          },
        ],
        error: null,
      },
    })
    const res = await POST(postRequest("http://localhost/api/search", { query: "fintech founder" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.searchMode).toBe("hybrid")
    expect(json.totalMatches).toBe(1)
    expect(json.results[0].name).toBe("Sam Lee")
    expect(h.generateEmbeddingMock).toHaveBeenCalledWith("fintech founder")
  })

  it("falls back to keyword-only mode when semantic quota is exhausted", async () => {
    h.semanticAllowed = false
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: [
          {
            id: "c1",
            name: "Sam Lee",
            company: "Plaid",
            last_contact_date: "2026-04-01",
            created_at: "2026-01-01",
          },
        ],
        error: null,
      },
    })
    const res = await POST(postRequest("http://localhost/api/search", { query: "fintech" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.searchMode).toBe("keyword")
    expect(h.generateEmbeddingMock).not.toHaveBeenCalled()
  })

  it("falls back to keyword mode when embedding generation returns null", async () => {
    h.generateEmbeddingMock.mockResolvedValueOnce(null)
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [], error: null },
    })
    const res = await POST(postRequest("http://localhost/api/search", { query: "fintech" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.searchMode).toBe("keyword")
  })

  it("returns an empty result set when no contacts match", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [], error: null },
      rpcResult: { data: [], error: null },
    })
    const res = await POST(postRequest("http://localhost/api/search", { query: "nobody" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.results).toEqual([])
    expect(json.totalMatches).toBe(0)
  })

  it("accepts facet filters in the request body", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: {
        data: [
          {
            id: "c1",
            name: "Sam Lee",
            company: "Plaid",
            last_contact_date: "2026-04-01",
            created_at: "2026-01-01",
          },
        ],
        error: null,
      },
      rpcResult: { data: [], error: null },
    })
    const res = await POST(
      postRequest("http://localhost/api/search", {
        query: "founder",
        filters: { companies: ["Plaid"] },
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.results.length).toBe(1)
  })
})
