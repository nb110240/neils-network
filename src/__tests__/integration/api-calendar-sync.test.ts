import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { buildRequest } from "../helpers/mock-request"

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

vi.mock("@/lib/subscription", () => ({
  getUserPlan: vi.fn(async () => h.plan),
}))

vi.mock("@/lib/openai", () => ({
  generateEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
  buildContactEmbeddingText: vi.fn(() => "embedding text"),
}))

import { GET, POST } from "@/app/api/calendar/sync/route"

const URL = "http://localhost/api/calendar/sync"

// Local-only helper: builds a Supabase mock whose query results vary by
// table name. The shared mock-supabase helper returns one fixed shape for
// every table, which breaks routes that read several tables in one request.
function perTableSupabase(opts: {
  authUser: { id: string; email?: string } | null
  tables: Record<string, unknown>
}) {
  function makeBuilder(tableData: unknown) {
    const result = {
      data: tableData,
      error: null as null | { message: string; code?: string },
    }
    const builder: Record<string, unknown> = {}
    for (const m of [
      "select", "insert", "update", "delete", "upsert", "eq", "neq",
      "gt", "lt", "gte", "lte", "in", "is", "or", "ilike", "order", "limit",
    ]) {
      builder[m] = vi.fn(() => builder)
    }
    builder.single = vi.fn(async () => ({
      data: Array.isArray(tableData) ? tableData[0] ?? null : tableData,
      error: null,
    }))
    builder.maybeSingle = vi.fn(async () => ({
      data: Array.isArray(tableData) ? tableData[0] ?? null : tableData,
      error: null,
    }))
    builder.then = (resolve: (v: unknown) => void) =>
      Promise.resolve(result).then(resolve)
    return builder
  }
  return {
    from: vi.fn((table: string) => makeBuilder(opts.tables[table] ?? [])),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.authUser } })),
      signOut: vi.fn(async () => ({ error: null })),
      admin: {
        deleteUser: vi.fn(async () => ({ error: null })),
        getUserById: vi.fn(async () => ({ data: { user: opts.authUser }, error: null })),
      },
    },
  }
}

describe("/api/calendar/sync", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
    process.env.CRON_SECRET = "test-cron-secret"
    process.env.GOOGLE_CLIENT_ID = "test-client-id"
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret"
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.unstubAllGlobals()
  })

  describe("POST (manual sync)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      h.supabase = createMockSupabase({ authUser: null })
      const res = await POST()
      expect(res.status).toBe(401)
    })

    it("returns 429 when rate limited", async () => {
      h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@x.com" } })
      h.rateLimitSuccess = false
      const res = await POST()
      expect(res.status).toBe(429)
    })

    it("returns a 'no calendar connected' result when the user has no integration", async () => {
      // syncCalendarForUser fetches the integration via .single() — null data
      // means no calendar connected, which is a 200 with a message.
      h.supabase = createMockSupabase({
        authUser: { id: "u1", email: "u1@x.com" },
        queryResult: { data: null, error: null },
      })
      const res = await POST()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.message).toBe("No calendar connected")
      expect(json.newContacts).toBe(0)
    })

    it("syncs calendar events on the happy path with Google mocked", async () => {
      // syncCalendarForUser issues table-specific queries: integrations
      // resolves via .single() (object), contacts/contact_activities resolve
      // as awaited thenables (array). The shared helper returns one shape for
      // every table, so build a per-table client for this flow.
      h.supabase = perTableSupabase({
        authUser: { id: "u1", email: "u1@x.com" },
        tables: {
          integrations: {
            id: "int1",
            access_token: "ya29.token",
            refresh_token: "1//refresh",
            token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
          contacts: [],
          contact_activities: [],
        },
      })
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            items: [
              {
                id: "evt1",
                summary: "Coffee chat",
                start: { dateTime: "2026-05-01T10:00:00Z" },
                attendees: [
                  { email: "u1@x.com" },
                  { email: "jane@acme.com", displayName: "Jane" },
                ],
              },
            ],
          }),
          text: async () => "",
        }))
      )
      const res = await POST()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.eventsProcessed).toBe(1)
    })

    it("returns 500 when the sync throws unexpectedly", async () => {
      h.supabase = createMockSupabase({
        authUser: { id: "u1", email: "u1@x.com" },
        queryResult: {
          data: {
            id: "int1",
            access_token: "ya29.token",
            token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
          error: null,
        },
      })
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("network down")
        })
      )
      const res = await POST()
      expect(res.status).toBe(500)
    })
  })

  describe("GET (cron sync)", () => {
    it("rejects requests without a valid cron secret with 401", async () => {
      h.supabase = createMockSupabase({ authUser: null })
      const res = await GET(buildRequest({ url: URL }))
      expect(res.status).toBe(401)
    })

    it("rejects a wrong bearer token with 401", async () => {
      h.supabase = createMockSupabase({ authUser: null })
      const res = await GET(
        buildRequest({ url: URL, headers: { authorization: "Bearer wrong-secret" } })
      )
      expect(res.status).toBe(401)
    })

    it("returns 'no integrations' when there are none", async () => {
      h.supabase = createMockSupabase({
        authUser: null,
        queryResult: { data: [], error: null },
      })
      const res = await GET(
        buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.synced).toBe(0)
    })
  })
})
