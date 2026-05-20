import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as unknown,
  rateLimitSuccess: true,
  plan: "pro" as "free" | "pro" | "team",
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

// `after()` requires a Next.js request scope that does not exist under
// vitest. Replace it with a synchronous runner so background embedding
// work still executes (and our mocked OpenAI absorbs it) without throwing.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")
  return { ...actual, after: (fn: () => unknown) => { void fn() } }
})

vi.mock("@/lib/subscription", () => ({
  getUserPlan: vi.fn(async () => h.plan),
  getPlanLimits: vi.fn((plan: string) => ({
    maxContacts: plan === "free" ? 50 : Infinity,
    canImport: plan !== "free",
    canCalendarSync: plan !== "free",
  })),
}))

vi.mock("@/lib/openai", () => ({
  generateEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
  buildContactEmbeddingText: vi.fn(() => "embedding text"),
}))

import { POST, PUT } from "@/app/api/import/csv/route"

const URL = "http://localhost/api/import/csv"

// Local-only Supabase mock. The contacts table is read once for dedup
// (returns []) and written once via insert().select() (returns the rows
// passed to insert, each given a synthetic id).
function importSupabase(opts: {
  authUser: { id: string; email?: string } | null
  insertError?: { message: string; code?: string } | null
}) {
  function contactsBuilder() {
    let insertedRows: unknown[] | null = null
    const builder: Record<string, unknown> = {}
    for (const m of [
      "select", "update", "delete", "upsert", "eq", "neq", "gt", "lt",
      "gte", "lte", "in", "is", "or", "ilike", "order", "limit",
    ]) {
      builder[m] = vi.fn(() => builder)
    }
    builder.insert = vi.fn((rows: unknown) => {
      const arr = Array.isArray(rows) ? rows : [rows]
      insertedRows = arr.map((r, i) => ({ id: `c${i}`, ...(r as object) }))
      return builder
    })
    builder.single = vi.fn(async () => ({ data: null, error: null }))
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    builder.then = (resolve: (v: unknown) => void) => {
      const result =
        insertedRows !== null
          ? { data: opts.insertError ? null : insertedRows, error: opts.insertError ?? null }
          : { data: [], error: null }
      return Promise.resolve(result).then(resolve)
    }
    return builder
  }
  return {
    from: vi.fn(() => contactsBuilder()),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.authUser } })),
      signOut: vi.fn(async () => ({ error: null })),
      admin: { deleteUser: vi.fn(async () => ({ error: null })) },
    },
  }
}

function csvFormRequest(opts: {
  csv?: string
  mapping?: unknown
  omitFile?: boolean
  omitMapping?: boolean
  fileSize?: number
}) {
  const fd = new FormData()
  if (!opts.omitFile) {
    const content = opts.fileSize
      ? "x".repeat(opts.fileSize)
      : opts.csv ?? "name,email\nJohn,john@x.com"
    fd.append("file", new File([content], "contacts.csv", { type: "text/csv" }))
  }
  if (!opts.omitMapping) {
    fd.append(
      "mapping",
      typeof opts.mapping === "string"
        ? opts.mapping
        : JSON.stringify(opts.mapping ?? { name: "name", email: "email" })
    )
  }
  return new Request(URL, { method: "POST", body: fd })
}

describe("/api/import/csv", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("POST (import)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      h.supabase = importSupabase({ authUser: null })
      const res = await POST(csvFormRequest({}))
      expect(res.status).toBe(401)
    })

    it("returns 403 for free-plan users (Pro-gated import)", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      h.plan = "free"
      const res = await POST(csvFormRequest({}))
      expect(res.status).toBe(403)
    })

    it("returns 400 when the file or mapping is missing", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await POST(csvFormRequest({ omitMapping: true }))
      expect(res.status).toBe(400)
    })

    it("returns 400 for invalid JSON in the mapping", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await POST(csvFormRequest({ mapping: "{not json" }))
      expect(res.status).toBe(400)
    })

    it("returns 400 when the mapping targets a disallowed field", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await POST(csvFormRequest({ mapping: { name: "name", email: "ssn" } }))
      expect(res.status).toBe(400)
    })

    it("returns 400 when no valid contacts are found (no name column)", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await POST(
        csvFormRequest({ csv: "email\njohn@x.com", mapping: { email: "email" } })
      )
      expect(res.status).toBe(400)
    })

    it("imports contacts on the happy path", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await POST(
        csvFormRequest({
          csv: "name,email\nJohn Doe,john@x.com\nJane Roe,jane@y.com",
          mapping: { name: "name", email: "email" },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.imported).toBe(2)
    })

    it("returns 500 when the database insert fails", async () => {
      h.supabase = importSupabase({
        authUser: { id: "u1" },
        insertError: { message: "db down" },
      })
      const res = await POST(
        csvFormRequest({ csv: "name,email\nJohn,john@x.com", mapping: { name: "name", email: "email" } })
      )
      expect(res.status).toBe(500)
    })
  })

  describe("PUT (preview)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      h.supabase = importSupabase({ authUser: null })
      const fd = new FormData()
      fd.append("file", new File(["name\nJohn"], "c.csv", { type: "text/csv" }))
      const res = await PUT(new Request(URL, { method: "PUT", body: fd }))
      expect(res.status).toBe(401)
    })

    it("returns 400 when the file is missing", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await PUT(new Request(URL, { method: "PUT", body: new FormData() }))
      expect(res.status).toBe(400)
    })

    it("returns parsed headers and rows for a valid CSV", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const fd = new FormData()
      fd.append("file", new File(["name,email\nJohn,john@x.com"], "c.csv", { type: "text/csv" }))
      const res = await PUT(new Request(URL, { method: "PUT", body: fd }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.headers).toEqual(["name", "email"])
      expect(json.rows.length).toBe(1)
    })
  })
})
