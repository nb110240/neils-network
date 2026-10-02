import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest, getRequest } from "../helpers/mock-request"
import { CONTACT_COLUMNS } from "@/lib/contact-columns"
import { readFileSync } from "node:fs"
import { join } from "node:path"

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

import { POST, GET } from "@/app/api/contacts/route"
import { revalidatePath } from "next/cache"

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

  it("revalidates dashboard, reach-out and contacts after creating (regression)", async () => {
    vi.mocked(revalidatePath).mockClear()
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [], error: null },
    })
    const res = await POST(postRequest(URL, { raw_note: "Met Ada at a conference" }))
    expect(res.status).toBe(200)
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePath).toHaveBeenCalledWith("/reach-out")
    expect(revalidatePath).toHaveBeenCalledWith("/contacts")
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

describe("POST /api/contacts without a name", () => {
  // Regression: when AI extraction failed (all fields null), /add saved a
  // contact with name=null and the page fired activation for it.
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.contactLimitAllowed = true
    h.extracted = { name: null, email: null, company: null }
  })

  it("returns 422 asking for a name and saves nothing", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" }, queryResult: { data: [], error: null } })
    const res = await POST(postRequest(URL, { raw_note: "Priya Raman\nPartner at Lightspeed, wants the deck" }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.needs_name).toBe(true)
    expect(json.error).toMatch(/name/i)
    expect(json.suggested_name).toBe("Priya Raman")
    expect(h.supabase._queryBuilder.insert).not.toHaveBeenCalled()
  })

  it("tells a capped free user about the limit before asking for a name", async () => {
    // Otherwise they type a name only to be told they can't add anyone.
    h.contactLimitAllowed = false
    h.supabase = createMockSupabase({ authUser: { id: "u1" }, queryResult: { data: [], error: null } })
    const res = await POST(postRequest(URL, { raw_note: "great chat about seed rounds" }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/contact limit/)
    expect(h.supabase._queryBuilder.insert).not.toHaveBeenCalled()
  })

  it("does not suggest a name when the first line is not one", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" }, queryResult: { data: [], error: null } })
    const res = await POST(postRequest(URL, { raw_note: "great chat at the demo day about seed rounds" }))
    expect(res.status).toBe(422)
    expect((await res.json()).suggested_name).toBeNull()
  })

  it("saves with the name the user typed", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" }, queryResult: { data: [], error: null } })
    const res = await POST(postRequest(URL, { raw_note: "great chat about seed rounds", name: "  Sam Lee " }))
    expect(res.status).toBe(200)
    expect(h.supabase._queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: "Sam Lee" }))
  })

  it("keeps offline-queued notes (no one to prompt) with a best-guess name", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" }, queryResult: { data: [], error: null } })
    const res = await POST(postRequest(URL, { raw_note: "Met Jane Doe, partner at Acme", allow_unnamed: true }))
    expect(res.status).toBe(200)
    expect(h.supabase._queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: "Jane Doe" }))
  })

  it("/add only tracks contact_created after a successful save", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(dashboard)/add/page.tsx"), "utf8")
    const needsName = source.indexOf("payload.needs_name")
    const track = source.indexOf('trackContactsCreated("natural_language"')
    expect(needsName).toBeGreaterThan(-1)
    expect(track).toBeGreaterThan(needsName)
  })
})

describe("GET /api/contacts (embedding column excluded)", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ada Lovelace",
    last_contact_date: "2026-06-01",
    created_at: "2026-05-01T00:00:00.000Z",
  }

  it("CONTACT_COLUMNS excludes the embedding vector but keeps embedding_status", () => {
    const columns = CONTACT_COLUMNS.split(",").map((c) => c.trim())
    expect(columns).not.toContain("embedding")
    expect(columns).toContain("embedding_status")
    expect(columns).toContain("archived_at")
    // The graph page links contacts that share an event (graph/page.tsx reads
    // c.event_id from /api/contacts) — dropping it silently breaks event links.
    expect(columns).toContain("event_id")
  })

  it("selects CONTACT_COLUMNS (not *) on the no-limit path and returns no embedding key", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [row], error: null },
    })
    const res = await GET(getRequest(URL))
    expect(res.status).toBe(200)

    // The row query must use the explicit column list, never select("*").
    expect(h.supabase!._queryBuilder.select).toHaveBeenCalledWith(CONTACT_COLUMNS)

    const json = await res.json()
    expect(json.contacts).toHaveLength(1)
    for (const contact of json.contacts) {
      expect(contact).not.toHaveProperty("embedding")
      expect(contact).toHaveProperty("health")
    }
  })

  it("selects CONTACT_COLUMNS (not *) for row data on the paginated path", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [row], error: null, count: 1 },
    })
    const res = await GET(getRequest(URL, { limit: "25" }))
    expect(res.status).toBe(200)

    // Two selects: the head-only count (columns irrelevant, no rows returned)
    // and the row query, which must use the explicit column list.
    const selectCalls = h.supabase!._queryBuilder.select.mock.calls
    const rowSelects = selectCalls.filter(
      (args: unknown[]) => !(args[1] as { head?: boolean } | undefined)?.head
    )
    expect(rowSelects.length).toBeGreaterThan(0)
    for (const args of rowSelects) {
      expect(args[0]).toBe(CONTACT_COLUMNS)
    }

    const json = await res.json()
    for (const contact of json.contacts) {
      expect(contact).not.toHaveProperty("embedding")
    }
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await GET(getRequest(URL))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await GET(getRequest(URL))
    expect(res.status).toBe(429)
  })

  it("returns 500 with an error body when the no-limit query fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db down" } },
    })
    const res = await GET(getRequest(URL))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe("Failed to fetch contacts")
  })

  it("returns 500 with an error body when the paginated query fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "db down" } },
    })
    const res = await GET(getRequest(URL, { limit: "25" }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe("Failed to fetch contacts")
  })

  it("slices to the limit and sets hasMore/nextCursor when an extra row comes back", async () => {
    // Route fetches limit + 1 rows to probe hasMore — feed it exactly 26 for limit=25.
    const rows = Array.from({ length: 26 }, (_, i) => ({
      ...row,
      id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      created_at: new Date(Date.UTC(2026, 4, 31, 0, 0, 59 - i)).toISOString(),
    }))
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: rows, error: null, count: 200 },
    })
    const res = await GET(getRequest(URL, { limit: "25" }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.contacts).toHaveLength(25)
    expect(json.pagination.hasMore).toBe(true)
    // nextCursor is the created_at of the last returned item (the 25th row).
    expect(json.pagination.nextCursor).toBe(json.contacts[24].created_at)
    expect(json.pagination.nextCursor).toBe(rows[24].created_at)
  })

  it("clamps an oversized limit to 100 and fetches 101 rows for the hasMore probe", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [], error: null, count: 0 },
    })
    const res = await GET(getRequest(URL, { limit: "1000" }))
    expect(res.status).toBe(200)

    // Route clamps: min(max(1, parseInt), 100), then queries limit + 1.
    expect(h.supabase!._queryBuilder.limit).toHaveBeenCalledWith(101)
  })

  it("returns an empty page with hasMore false when no rows match", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: [], error: null, count: 0 },
    })
    const res = await GET(getRequest(URL, { limit: "25" }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.contacts).toEqual([])
    expect(json.pagination.hasMore).toBe(false)
    expect(json.pagination.nextCursor).toBeNull()
  })
})
