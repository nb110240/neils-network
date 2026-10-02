import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as unknown,
  rateLimitSuccess: true,
  plan: "pro" as "free" | "pro" | "team",
  contactLimitAllowed: true,
  contactLimit: Infinity as number,
  contactCount: 0,
  cookies: new Map<string, string>(),
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

// `after()` requires a Next.js request scope absent under vitest.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")
  return { ...actual, after: (fn: () => unknown) => { void fn() } }
})

// In-memory cookie jar standing in for next/headers.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      h.cookies.has(name) ? { name, value: h.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => { h.cookies.set(name, value) },
    delete: (name: string) => { h.cookies.delete(name) },
  })),
}))

vi.mock("@/lib/subscription", () => ({
  getUserPlan: vi.fn(async () => h.plan),
  getPlanLimits: vi.fn((plan: string) => ({
    maxContacts: plan === "free" ? 50 : Infinity,
    canImport: plan !== "free",
    canCalendarSync: plan !== "free",
  })),
  checkContactLimit: vi.fn(async () => ({
    allowed: h.contactLimitAllowed,
    plan: h.plan,
    count: h.contactCount,
    limit: h.contactLimit,
  })),
}))

vi.mock("@/lib/openai", () => ({
  generateEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
  buildContactEmbeddingText: vi.fn(() => "embedding text"),
}))

import { GET, POST } from "@/app/api/import/google/route"
import { revalidatePath } from "next/cache"

const URL = "http://localhost/api/import/google"

// Local-only Supabase mock. contacts is read for dedup (returns []) and
// written via insert().select() (returns inserted rows with synthetic ids).
function importSupabase(opts: {
  authUser: { id: string; email?: string } | null
  insertError?: { message: string; code?: string } | null
}) {
  function contactsBuilder() {
    let insertedRows: unknown[] | null = null
    const builder: Record<string, unknown> = {}
    for (const m of [
      "select", "update", "delete", "upsert", "eq", "neq", "gt", "lt",
      "gte", "lte", "in", "is", "or", "ilike", "order", "limit", "range",
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

describe("/api/import/google", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
    h.contactLimitAllowed = true
    h.contactLimit = Infinity
    h.contactCount = 0
    h.cookies = new Map()
    process.env.GOOGLE_CLIENT_ID = "test-client-id"
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001"
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.unstubAllGlobals()
  })

  describe("GET (OAuth URL)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      h.supabase = importSupabase({ authUser: null })
      const res = await GET()
      expect(res.status).toBe(401)
    })

    it("returns 403 for free-plan users (Pro-gated import)", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      h.plan = "free"
      const res = await GET()
      expect(res.status).toBe(403)
    })

    it("returns a Google OAuth URL and sets a CSRF state cookie", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await GET()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.url).toContain("https://accounts.google.com/o/oauth2/v2/auth")
      expect(h.cookies.has("google_import_state")).toBe(true)
    })

    it("returns 500 when Google OAuth is not configured", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      delete process.env.GOOGLE_CLIENT_ID
      const res = await GET()
      expect(res.status).toBe(500)
    })
  })

  describe("POST (import contacts)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      h.supabase = importSupabase({ authUser: null })
      const res = await POST(postRequest(URL, {}))
      expect(res.status).toBe(401)
    })

    it("returns 400 when the Google token cookie is missing", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      const res = await POST(postRequest(URL, {}))
      expect(res.status).toBe(400)
    })

    it("returns 403 when the token cookie belongs to a different user", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      h.cookies.set(
        "google_import_token",
        JSON.stringify({ userId: "other-user", token: "ya29.token" })
      )
      const res = await POST(postRequest(URL, {}))
      expect(res.status).toBe(403)
    })

    it("returns 400 when the token cookie is malformed", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      h.cookies.set("google_import_token", "{not json")
      const res = await POST(postRequest(URL, {}))
      expect(res.status).toBe(400)
    })

    it("returns 500 when the Google People API call fails", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      h.cookies.set(
        "google_import_token",
        JSON.stringify({ userId: "u1", token: "ya29.token" })
      )
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })))
      const res = await POST(postRequest(URL, {}))
      expect(res.status).toBe(500)
    })

    it("returns 400 when Google returns no usable contacts", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      h.cookies.set(
        "google_import_token",
        JSON.stringify({ userId: "u1", token: "ya29.token" })
      )
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => ({ connections: [] }) }))
      )
      const res = await POST(postRequest(URL, {}))
      expect(res.status).toBe(400)
    })

    it("returns 403 when the user has hit the contact limit", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      h.contactLimitAllowed = false
      h.contactLimit = 50
      h.cookies.set(
        "google_import_token",
        JSON.stringify({ userId: "u1", token: "ya29.token" })
      )
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            connections: [
              { names: [{ displayName: "Jane Roe" }], emailAddresses: [{ value: "jane@x.com" }] },
            ],
          }),
        }))
      )
      const res = await POST(postRequest(URL, {}))
      expect(res.status).toBe(403)
    })

    it("imports Google contacts on the happy path", async () => {
      h.supabase = importSupabase({ authUser: { id: "u1" } })
      h.cookies.set(
        "google_import_token",
        JSON.stringify({ userId: "u1", token: "ya29.token" })
      )
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            connections: [
              {
                names: [{ displayName: "Jane Roe" }],
                emailAddresses: [{ value: "jane@x.com" }],
                phoneNumbers: [{ value: "+15551234" }],
                organizations: [{ name: "Acme", title: "CEO" }],
              },
              {
                names: [{ displayName: "Bob Smith" }],
                emailAddresses: [{ value: "bob@y.com" }],
              },
            ],
          }),
        }))
      )
      vi.mocked(revalidatePath).mockClear()
      const res = await POST(postRequest(URL, {}))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.imported).toBe(2)
      // Regression: imported contacts did not show until the cache expired.
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard")
      expect(revalidatePath).toHaveBeenCalledWith("/reach-out")
      expect(revalidatePath).toHaveBeenCalledWith("/contacts")
    })
  })
})
