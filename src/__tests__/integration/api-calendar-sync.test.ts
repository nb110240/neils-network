import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { buildRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as unknown,
  rateLimitSuccess: true,
  plan: "pro" as "free" | "pro" | "team",
  analysis: vi.fn(),
  sendPush: vi.fn(async () => ({ sent: 1, removed: 0 })),
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

vi.mock("@/lib/action-extraction", () => ({ analyzeInteraction: h.analysis }))
vi.mock("@/lib/push/send", () => ({ sendPushToUser: h.sendPush }))

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
      "gt", "lt", "gte", "lte", "in", "is", "or", "ilike", "order", "limit", "range",
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
  const builders: Array<{ table: string; builder: Record<string, ReturnType<typeof vi.fn>> }> = []
  return {
    builders,
    from: vi.fn((table: string) => {
      const builder = makeBuilder(opts.tables[table] ?? [])
      builders.push({ table, builder: builder as Record<string, ReturnType<typeof vi.fn>> })
      return builder
    }),
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
    h.analysis.mockReset()
    h.sendPush.mockClear()
    h.analysis.mockResolvedValue({
      summary: "Jane will send the deck.",
      contactPatch: {},
      commitments: [],
      followUpDraft: null,
    })
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

    it("rejects manual sync for a downgraded free user before using calendar or AI", async () => {
      h.plan = "free"
      h.supabase = createMockSupabase({ authUser: { id: "u1", email: "u1@x.com" } })
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const response = await POST()
      expect(response.status).toBe(403)
      expect((await response.json()).error).toContain("Pro feature")
      expect(fetchMock).not.toHaveBeenCalled()
      expect(h.analysis).not.toHaveBeenCalled()
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

    it("turns meaningful calendar descriptions into deduplicated pending reviews", async () => {
      h.supabase = perTableSupabase({
        authUser: { id: "u1", email: "u1@x.com" },
        tables: {
          integrations: {
            id: "int1",
            access_token: "ya29.token",
            refresh_token: "1//refresh",
            token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
          contacts: [{
            id: "contact-1",
            email: "jane@acme.com",
            name: "Jane",
            company: "Acme",
            job_title: "Partner",
            how_we_met: null,
            next_steps: null,
          }],
          contact_activities: [],
          after_call_reviews: [],
        },
      })
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            items: [{
              id: "evt-with-notes",
              summary: "Investor update",
              description: "<p>Jane agreed to send the partnership deck by Friday.</p>",
              start: { dateTime: "2026-05-01T10:00:00Z" },
              attendees: [
                { email: "u1@x.com" },
                { email: "jane@acme.com", displayName: "Jane" },
              ],
            }],
          }),
          text: async () => "",
        }))
      )

      const res = await POST()
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(json.reviewsCreated).toBe(1)
      expect(h.analysis).toHaveBeenCalledOnce()
      expect(h.analysis).toHaveBeenCalledWith(expect.objectContaining({
        rawText: "Jane agreed to send the partnership deck by Friday.",
        existingContact: expect.objectContaining({ email: "jane@acme.com" }),
      }))
    })

    it("bumps last_contact_date for matched contacts whose date is null", async () => {
      // Regression: .lt("last_contact_date", date) never matches NULL, so
      // imported contacts with no last-contact date were never warmed by a
      // real meeting and kept showing as going cold.
      const client = perTableSupabase({
        authUser: { id: "u1", email: "u1@x.com" },
        tables: {
          integrations: {
            id: "int1",
            access_token: "ya29.token",
            token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
          contacts: [{ id: "contact-1", email: "jane@acme.com", name: "Jane", last_contact_date: null }],
          contact_activities: [],
          after_call_reviews: [],
        },
      })
      h.supabase = client
      vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [{
            id: "evt-null-date",
            summary: "Coffee",
            start: { dateTime: "2026-05-01T10:00:00Z" },
            attendees: [{ email: "u1@x.com" }, { email: "jane@acme.com", displayName: "Jane" }],
          }],
        }),
        text: async () => "",
      })))

      const res = await POST()
      expect(res.status).toBe(200)
      const updates = client.builders.filter(
        ({ table, builder }) =>
          table === "contacts" &&
          builder.update.mock.calls.some(([patch]) => patch?.last_contact_date === "2026-05-01")
      )
      expect(updates).toHaveLength(1)
      const { builder } = updates[0]
      expect(builder.lt).not.toHaveBeenCalled()
      expect(builder.or).toHaveBeenCalledWith("last_contact_date.is.null,last_contact_date.lt.2026-05-01")
    })

    it("filters existing reviews before capping the next five unseen events", async () => {
      const events = Array.from({ length: 6 }, (_, index) => ({
        id: `evt-${index + 1}`,
        summary: `Investor update ${index + 1}`,
        description: `Jane shared meaningful meeting notes number ${index + 1}.`,
        start: { dateTime: `2026-05-0${index + 1}T10:00:00Z` },
        attendees: [
          { email: "u1@x.com" },
          { email: "jane@acme.com", displayName: "Jane" },
        ],
      }))
      h.supabase = perTableSupabase({
        authUser: { id: "u1", email: "u1@x.com" },
        tables: {
          integrations: {
            id: "int1",
            access_token: "ya29.token",
            token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
          contacts: [{ id: "contact-1", email: "jane@acme.com", name: "Jane" }],
          contact_activities: [],
          after_call_reviews: ["evt-6", "evt-5", "evt-4", "evt-3", "evt-2"].map((external_source_id) => ({ external_source_id })),
        },
      })
      vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: events }),
        text: async () => "",
      })))

      const response = await POST()
      expect(response.status).toBe(200)
      expect((await response.json()).reviewsCreated).toBe(1)
      expect(h.analysis).toHaveBeenCalledOnce()
      expect(h.analysis).toHaveBeenCalledWith(expect.objectContaining({ title: "Investor update 1" }))
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
      const client = createMockSupabase({
        authUser: null,
        queryResult: { data: [], error: null },
      })
      h.supabase = client
      const res = await GET(
        buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.synced).toBe(0)
      expect(client._queryBuilder.order).toHaveBeenCalledWith("last_attempt_at", { ascending: true, nullsFirst: true })
      expect(client._queryBuilder.limit).toHaveBeenCalledWith(3)
    })
  })

  describe("push after background sync", () => {
    const eventWithNotes = {
      items: [{
        id: "evt-with-notes",
        summary: "Investor update",
        description: "<p>Jane agreed to send the partnership deck by Friday.</p>",
        start: { dateTime: "2026-05-01T10:00:00Z" },
        attendees: [{ email: "u1@x.com" }, { email: "jane@acme.com", displayName: "Jane" }],
      }],
    }
    const tables = () => ({
      integrations: [{
        id: "int1",
        user_id: "u1",
        access_token: "ya29.token",
        refresh_token: "1//refresh",
        token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      }],
      contacts: [{ id: "contact-1", email: "jane@acme.com", name: "Jane", company: "Acme", job_title: "Partner", how_we_met: null, next_steps: null }],
      contact_activities: [],
      after_call_reviews: [],
    })

    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => eventWithNotes, text: async () => "" })))
    })

    it("asks how the meetings went when the cron created reviews", async () => {
      const client = perTableSupabase({ authUser: { id: "u1", email: "u1@x.com" }, tables: tables() })
      h.supabase = client
      const res = await GET(buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } }))
      expect((await res.json()).synced).toBe(1)
      expect(h.sendPush).toHaveBeenCalledWith(client, "u1", expect.objectContaining({
        title: "How did your meetings go?",
        body: "Notes from a recent meeting are ready to review",
        url: "/inbox",
      }))
    })

    it("stays quiet for a manual sync, where the person is already in the app", async () => {
      h.supabase = perTableSupabase({ authUser: { id: "u1", email: "u1@x.com" }, tables: tables() })
      const res = await POST()
      expect((await res.json()).reviewsCreated).toBe(1)
      expect(h.sendPush).not.toHaveBeenCalled()
    })
  })
})
