import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  plan: "pro" as "free" | "pro",
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

// Plan gating — permissive by default, toggled per test
vi.mock("@/lib/subscription", () => ({
  getUserPlan: vi.fn(async () => h.plan),
  checkContactLimit: vi.fn(async () => ({
    allowed: h.contactLimitAllowed,
    plan: h.plan,
    count: 5,
    limit: 1000,
  })),
}))

// No real network for embeddings
vi.mock("@/lib/openai", () => ({
  generateEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
  buildContactEmbeddingText: vi.fn(() => "embedding text"),
}))

import { POST } from "@/app/api/contacts/linkedin/route"

const URL = "http://localhost/api/contacts/linkedin"
const LINKEDIN_URL = "https://linkedin.com/in/johndoe"

// The route chains `.ilike(...)`, which the shared mock builder does not
// provide. Augment the builder in-test so the chain stays intact.
function withIlike(client: NonNullable<typeof h.supabase>) {
  const qb = client._queryBuilder as Record<string, unknown>
  qb.ilike = vi.fn().mockReturnValue(qb)
  return client
}

describe("POST /api/contacts/linkedin", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
    h.contactLimitAllowed = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, { url: LINKEDIN_URL }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, { url: LINKEDIN_URL }))
    expect(res.status).toBe(429)
  })

  it("returns 403 for free-plan users", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.plan = "free"
    const res = await POST(postRequest(URL, { url: LINKEDIN_URL }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/Pro/i)
  })

  it("returns 403 when the contact limit is reached", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.contactLimitAllowed = false
    const res = await POST(postRequest(URL, { url: LINKEDIN_URL }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/limit/i)
  })

  it("rejects a missing URL with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/required/i)
  })

  it("rejects a non-LinkedIn URL with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { url: "https://example.com/in/johndoe" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/LinkedIn/i)
  })

  it("rejects a malformed URL string with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest(URL, { url: "not even a url" }))
    expect(res.status).toBe(400)
  })

  it("returns 409 when a contact with the same LinkedIn URL already exists", async () => {
    // contacts website-match lookup returns an existing row
    h.supabase = withIlike(
      createMockSupabase({
        authUser: { id: "u1" },
        queryResult: { data: { id: "existing-contact" }, error: null },
      })
    )
    const res = await POST(postRequest(URL, { url: LINKEDIN_URL }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.contactId).toBe("existing-contact")
  })

  it("creates a contact from a LinkedIn URL on the happy path", async () => {
    h.supabase = withIlike(
      createMockSupabase({
        authUser: { id: "u1" },
        queryResult: {
          data: { id: "new-contact", name: "Johndoe", website: LINKEDIN_URL },
          error: null,
        },
      })
    )
    const qb = h.supabase._queryBuilder
    // .single() calls: (1) website-dup lookup → null so we proceed,
    // (2) the final insert → the new contact row.
    qb.single = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValue({
        data: { id: "new-contact", name: "Johndoe", website: LINKEDIN_URL },
        error: null,
      })
    // findDuplicates() (real dedup lib) awaits the builder directly and
    // iterates the result, so `then` must resolve to an array.
    Object.defineProperty(qb, "then", {
      value: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
      configurable: true,
    })
    const res = await POST(postRequest(URL, { url: LINKEDIN_URL }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.contact.id).toBe("new-contact")
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
