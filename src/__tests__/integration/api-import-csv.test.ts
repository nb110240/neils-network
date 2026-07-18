import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as unknown,
  rateLimitSuccess: true,
  plan: "pro" as "free" | "pro" | "team",
  insertedRows: [] as Record<string, unknown>[],
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
import { revalidatePath } from "next/cache"

const URL = "http://localhost/api/import/csv"

// Local-only Supabase mock. The contacts table is read once for dedup
// (returns []) and written once via insert().select() (returns the rows
// passed to insert, each given a synthetic id).
function importSupabase(opts: {
  authUser: { id: string; email?: string } | null
  insertError?: { message: string; code?: string } | null
  priorImportCount?: number
  allowance?: { allowed: boolean; remaining: number; used?: number }
}) {
  function contactsBuilder() {
    let insertedRows: unknown[] | null = null
    let countQuery = false
    const builder: Record<string, unknown> = {}
    for (const m of [
      "update", "delete", "upsert", "eq", "neq", "gt", "lt",
      "gte", "lte", "in", "is", "or", "ilike", "order", "limit",
    ]) {
      builder[m] = vi.fn(() => builder)
    }
    builder.select = vi.fn((_columns?: string, options?: { count?: string; head?: boolean }) => {
      countQuery = options?.count === "exact" && options?.head === true
      return builder
    })
    builder.insert = vi.fn((rows: unknown) => {
      const arr = Array.isArray(rows) ? rows : [rows]
      insertedRows = arr.map((r, i) => ({ id: `c${i}`, ...(r as object) }))
      h.insertedRows = insertedRows as Record<string, unknown>[]
      return builder
    })
    builder.single = vi.fn(async () => ({ data: null, error: null }))
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    builder.then = (resolve: (v: unknown) => void) => {
      const result =
        insertedRows !== null
          ? { data: opts.insertError ? null : insertedRows, error: opts.insertError ?? null }
          : { data: [], error: null, ...(countQuery ? { count: opts.priorImportCount || 0 } : {}) }
      return Promise.resolve(result).then(resolve)
    }
    return builder
  }
  return {
    from: vi.fn(() => contactsBuilder()),
    rpc: vi.fn(async (name: string) => ({
      data: name === "reserve_free_csv_contacts"
        ? (opts.allowance || { allowed: true, remaining: 0, used: 5 })
        : null,
      error: null,
    })),
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
    vi.clearAllMocks()
    h.rateLimitSuccess = true
    h.plan = "pro"
    h.insertedRows = []
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

    it("lets a free user import up to five onboarding contacts", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      h.plan = "free"
      const res = await POST(csvFormRequest({ csv: "name\nOne\nTwo\nThree\nFour\nFive", mapping: { name: "name" } }))
      expect(res.status).toBe(200)
      expect((await res.json()).imported).toBe(5)
    })

    it("rejects a free CSV that exceeds the remaining five-contact allowance", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" }, allowance: { allowed: false, remaining: 3, used: 2 } })
      h.plan = "free"
      const res = await POST(csvFormRequest({ csv: "name\nOne\nTwo\nThree\nFour", mapping: { name: "name" } }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toContain("room for 3 more contacts")
    })

    it("requires Pro after the free five-contact allowance is used", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" }, allowance: { allowed: false, remaining: 0, used: 5 } })
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
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard")
      expect(revalidatePath).toHaveBeenCalledWith("/reach-out")
      expect(revalidatePath).toHaveBeenCalledWith("/contacts")
    })

    it("preserves supported investor-template context and dates", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await POST(
        csvFormRequest({
          csv: [
            "Investor Name,Firm,Intro Path,Last Contact Date,Next Step,Next Step Date",
            "Jane Example,Example Ventures,Introduced by Ana,2026-05-10,Send metrics,2026-05-17",
          ].join("\n"),
          mapping: {
            "Investor Name": "name",
            Firm: "company",
            "Intro Path": "how_we_met",
            "Last Contact Date": "last_contact_date",
            "Next Step": "next_steps",
            "Next Step Date": "scheduled_follow_up",
          },
        })
      )

      expect(res.status).toBe(200)
      expect(h.insertedRows[0]).toMatchObject({
        name: "Jane Example",
        company: "Example Ventures",
        how_we_met: "Introduced by Ana",
        last_contact_date: "2026-05-10",
        next_steps: "Send metrics",
        scheduled_follow_up: "2026-05-17",
        follow_up_needed: true,
      })
    })

    it("normalizes dates exported by common spreadsheet tools", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await POST(
        csvFormRequest({
          csv: [
            "name,last,next",
            "Jane,7/10/2026,7/12/2026 00:00:00",
            "Sam,2026-07-08T00:00:00.000Z,2026-07-15 00:00:00",
          ].join("\n"),
          mapping: { name: "name", last: "last_contact_date", next: "scheduled_follow_up" },
        })
      )

      expect(res.status).toBe(200)
      expect(h.insertedRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Jane",
            last_contact_date: "2026-07-10",
            scheduled_follow_up: "2026-07-12",
            follow_up_needed: true,
          }),
          expect.objectContaining({
            name: "Sam",
            last_contact_date: "2026-07-08",
            scheduled_follow_up: "2026-07-15",
            follow_up_needed: true,
          }),
        ])
      )
    })

    it("drops invalid mapped dates instead of failing the whole import", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await POST(
        csvFormRequest({
          csv: "name,last,next\nJane,May someday,2026-02-30",
          mapping: { name: "name", last: "last_contact_date", next: "scheduled_follow_up" },
        })
      )

      expect(res.status).toBe(200)
      expect(h.insertedRows[0]).toMatchObject({
        last_contact_date: null,
        scheduled_follow_up: null,
        follow_up_needed: false,
      })
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

    it("refunds a reserved free allowance when the contact insert fails", async () => {
      h.plan = "free"
      const client = importSupabase({
        authUser: { id: "u1" },
        insertError: { message: "db down" },
        allowance: { allowed: true, remaining: 4, used: 1 },
      })
      h.supabase = client
      const res = await POST(
        csvFormRequest({ csv: "name,email\nJohn,john@x.com", mapping: { name: "name", email: "email" } })
      )
      expect(res.status).toBe(500)
      expect(client.rpc).toHaveBeenCalledWith("refund_free_csv_contacts", {
        target_user_id: "u1",
        refund_count: 1,
      })
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

    // Regression: totalRows used to be csvText.split("\n").length - 1, which
    // counted the trailing newline of a typical CSV export as an extra
    // contact ("2 contacts found" for a 1-row file).
    it("counts 1 contact for a 1-row CSV with a trailing newline", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const fd = new FormData()
      fd.append("file", new File(["name,email\nJohn,john@x.com\n"], "c.csv", { type: "text/csv" }))
      const res = await PUT(new Request(URL, { method: "PUT", body: fd }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.totalRows).toBe(1)
      expect(json.rows.length).toBe(1)
    })

    it("counts 1 contact for a 1-row CSV without a trailing newline", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const fd = new FormData()
      fd.append("file", new File(["name,email\nJohn,john@x.com"], "c.csv", { type: "text/csv" }))
      const res = await PUT(new Request(URL, { method: "PUT", body: fd }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.totalRows).toBe(1)
    })

    it("counts 0 contacts for a header-only CSV", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      for (const content of ["name,email", "name,email\n"]) {
        const fd = new FormData()
        fd.append("file", new File([content], "c.csv", { type: "text/csv" }))
        const res = await PUT(new Request(URL, { method: "PUT", body: fd }))
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.totalRows).toBe(0)
        expect(json.rows.length).toBe(0)
        expect(json.headers).toEqual(["name", "email"])
      }
    })

    it("caps preview rows at 5 but reports the full count", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const dataRows = Array.from({ length: 8 }, (_, i) => `Person ${i},p${i}@x.com`)
      const csv = `name,email\n${dataRows.join("\n")}\n`
      const fd = new FormData()
      fd.append("file", new File([csv], "c.csv", { type: "text/csv" }))
      const res = await PUT(new Request(URL, { method: "PUT", body: fd }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.totalRows).toBe(8)
      expect(json.rows.length).toBe(5)
    })
  })
})
