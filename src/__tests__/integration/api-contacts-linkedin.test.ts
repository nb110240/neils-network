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
import { revalidatePath } from "next/cache"

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
        queryResult: { data: [{ id: "existing-contact", website: "https://www.linkedin.com/in/johndoe" }], error: null },
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
    // .maybeSingle(): website-dup lookup → null so we proceed.
    // .single(): the final insert → the new contact row.
    qb.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    qb.single = vi.fn().mockResolvedValue({
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
    vi.mocked(revalidatePath).mockClear()
    const res = await POST(postRequest(URL, { url: LINKEDIN_URL }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.contact.id).toBe("new-contact")
    // Regression: LinkedIn imports did not refresh cached contact views.
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePath).toHaveBeenCalledWith("/reach-out")
    expect(revalidatePath).toHaveBeenCalledWith("/contacts")
  })

  it.each([
    // Regression: iOS "Share Profile" links end in a hex ID that leaked into the name.
    [
      "https://www.linkedin.com/in/priya-raman-4b7a1b2c3?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app",
      "Priya Raman",
      "%linkedin.com/in/priya-raman-4b7a1b2c3",
    ],
    // Accented names arrive percent-encoded and used to be rejected outright.
    [
      "https://www.linkedin.com/in/jos%C3%A9-garc%C3%ADa-12ab34cd/",
      "José García",
      "%linkedin.com/in/jos\\%C3\\%A9-garc\\%C3\\%ADa-12ab34cd",
    ],
  ])("derives a clean name from a real share URL: %s", async (url, expectedName, expectedPattern) => {
    h.supabase = withIlike(createMockSupabase({ authUser: { id: "u1" } }))
    const qb = h.supabase._queryBuilder
    qb.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    qb.single = vi.fn().mockResolvedValue({ data: { id: "new-contact" }, error: null })
    Object.defineProperty(qb, "then", {
      value: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
      configurable: true,
    })
    const res = await POST(postRequest(URL, { url }))
    expect(res.status).toBe(200)
    expect(qb.insert).toHaveBeenCalledWith(expect.objectContaining({ name: expectedName }))
    expect((qb as unknown as { ilike: ReturnType<typeof vi.fn> }).ilike).toHaveBeenCalledWith("website", expectedPattern)
  })

  function happyPathClient() {
    h.supabase = withIlike(createMockSupabase({ authUser: { id: "u1" } }))
    const qb = h.supabase._queryBuilder
    qb.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    qb.single = vi.fn().mockResolvedValue({ data: { id: "new-contact" }, error: null })
    Object.defineProperty(qb, "then", {
      value: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
      configurable: true,
    })
    return qb
  }

  it.each([
    // Regression: country subdomains were rejected outright.
    ["https://uk.linkedin.com/in/oliver-bennett-9a8b7c6d", "Oliver Bennett", "oliver-bennett-9a8b7c6d"],
    ["https://de.linkedin.com/in/lena-schmidt/?originalSubdomain=de", "Lena Schmidt", "lena-schmidt"],
    ["https://m.linkedin.com/in/sam-lee", "Sam Lee", "sam-lee"],
    ["linkedin.com/in/JaneDoe/", "JaneDoe", "janedoe"],
    ["www.linkedin.com/in/priya-raman-4b7a1b2c3?utm_source=share&utm_medium=member_desktop", "Priya Raman", "priya-raman-4b7a1b2c3"],
  ])("accepts %s and stores the canonical www URL", async (url, expectedName, slug) => {
    const qb = happyPathClient()
    const res = await POST(postRequest(URL, { url }))
    expect(res.status).toBe(200)
    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: expectedName, website: `https://www.linkedin.com/in/${slug}` })
    )
  })

  it.each([
    "https://linkedin.com.evil.com/in/jane",
    "https://evil-linkedin.com/in/jane",
    "https://www.linkedin.com/company/acme",
    "https://www.linkedin.com/in/",
    "javascript://linkedin.com/in/jane",
  ])("rejects %s", async (url) => {
    happyPathClient()
    const res = await POST(postRequest(URL, { url }))
    expect(res.status).toBe(400)
  })

  // The duplicate query is `.ilike(...).limit(n)`; feed it candidate rows.
  function withDuplicateCandidates(qb: ReturnType<typeof happyPathClient>, rows: { id: string; website: string }[]) {
    const limit = vi.fn(async () => ({ data: rows, error: null }))
    ;(qb as unknown as { ilike: ReturnType<typeof vi.fn> }).ilike = vi.fn(() => ({ limit }))
    return limit
  }

  it("returns 409 instead of a duplicate when two contacts already share the URL", async () => {
    // Regression: .single() errors when two rows match, and the route read
    // the error as "no duplicate" and created a third.
    const qb = happyPathClient()
    withDuplicateCandidates(qb, [
      { id: "first-match", website: "https://www.linkedin.com/in/oliver-bennett" },
      { id: "second-match", website: "linkedin.com/in/oliver-bennett/" },
    ])
    const res = await POST(postRequest(URL, { url: "https://uk.linkedin.com/in/oliver-bennett" }))
    expect(res.status).toBe(409)
    expect((await res.json()).contactId).toBe("first-match")
    expect(qb.insert).not.toHaveBeenCalled()
  })

  it("does not report a look-alike host as a duplicate", async () => {
    // Regression: the leading % in the ILIKE matched evil-linkedin.com and
    // limit(1) returned that unrelated contact's id with a 409.
    const qb = happyPathClient()
    withDuplicateCandidates(qb, [
      { id: "lookalike", website: "https://evil-linkedin.com/in/jane" },
      { id: "real", website: "https://www.linkedin.com/in/jane" },
    ])
    const res = await POST(postRequest(URL, { url: "https://www.linkedin.com/in/jane?utm_source=share" }))
    expect(res.status).toBe(409)
    expect((await res.json()).contactId).toBe("real")
  })

  it("creates the contact when the only candidate is a look-alike host", async () => {
    const qb = happyPathClient()
    withDuplicateCandidates(qb, [{ id: "lookalike", website: "https://evil-linkedin.com/in/jane" }])
    const res = await POST(postRequest(URL, { url: "linkedin.com/in/jane" }))
    expect(res.status).toBe(200)
    expect(qb.insert).toHaveBeenCalled()
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
