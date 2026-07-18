import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"

type Result = { data: unknown; error: null | { message: string; code?: string } }

const h = vi.hoisted(() => ({
  client: null as ReturnType<typeof perTableSupabase> | null,
  plan: "pro" as "free" | "pro" | "team",
  list: vi.fn(),
  get: vi.fn(),
  convert: vi.fn(),
  analyze: vi.fn(),
  inserts: [] as Array<{ table: string; value: unknown }>,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.client),
  createServiceClient: vi.fn(async () => h.client),
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock("@/lib/subscription", () => ({ getUserPlan: vi.fn(async () => h.plan) }))
vi.mock("@/lib/granola", () => ({
  listGranolaNotes: h.list,
  getGranolaNote: h.get,
  granolaNoteToMeetingText: h.convert,
}))
vi.mock("@/lib/action-extraction", () => ({ analyzeInteraction: h.analyze }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { POST as connect } from "@/app/api/granola/route"
import { POST as sync } from "@/app/api/granola/sync/route"

function perTableSupabase(options: { user?: { id: string; email?: string } | null; results?: Record<string, Result[]> } = {}) {
  const queued = Object.fromEntries(Object.entries(options.results || {}).map(([key, value]) => [key, [...value]]))
  return {
    from: vi.fn((table: string) => {
      const result = queued[table]?.shift() || { data: null, error: null }
      const builder: Record<string, unknown> = {}
      for (const method of ["select", "insert", "update", "delete", "upsert", "eq", "is", "in", "order", "limit"]) {
        builder[method] = vi.fn((value: unknown) => {
          if (method === "insert" || method === "upsert") h.inserts.push({ table, value })
          return builder
        })
      }
      builder.single = vi.fn(async () => result)
      builder.maybeSingle = vi.fn(async () => result)
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve)
      return builder
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user === undefined ? { id: "user-1", email: "neil@savvo.app" } : options.user } })),
    },
  }
}

const note = {
  id: "not_1d3tmYTlCICgjy",
  title: "Investor call",
  created_at: "2026-07-17T10:00:00Z",
  calendar_event: { scheduled_start_time: "2026-07-17T09:00:00Z" },
  attendees: [{ name: "Alex", email: "alex@fund.com" }],
}

describe("Granola connection and sync", () => {
  beforeEach(() => {
    h.plan = "pro"
    h.inserts = []
    h.client = perTableSupabase()
    h.list.mockReset()
    h.get.mockReset()
    h.convert.mockReset()
    h.analyze.mockReset()
    h.list.mockResolvedValue({ notes: [], hasMore: false, cursor: null })
  })

  it("does not accept or validate API keys for free users", async () => {
    h.plan = "free"
    const response = await connect(buildRequest({ method: "POST", body: { api_key: "grn_valid_key" } }))
    expect(response.status).toBe(403)
    expect(h.list).not.toHaveBeenCalled()
  })

  it("validates a key before storing it and never returns the secret", async () => {
    h.client = perTableSupabase({ results: { integrations: [{ data: null, error: null }] } })
    const response = await connect(buildRequest({ method: "POST", body: { api_key: "grn_valid_key" } }))
    expect(response.status).toBe(200)
    expect(h.list).toHaveBeenCalledWith("grn_valid_key", undefined, 1)
    expect(JSON.stringify(await response.json())).not.toContain("grn_valid_key")
  })

  it("imports a Granola transcript only as a pending review", async () => {
    h.list.mockResolvedValue({ notes: [note], hasMore: false, cursor: null })
    h.get.mockResolvedValue(note)
    h.convert.mockReturnValue("Alex agreed that I should send the investor deck by Friday.")
    h.analyze.mockResolvedValue({ summary: "Send deck", contactPatch: {}, commitments: [], followUpDraft: null })
    h.client = perTableSupabase({ results: {
      integrations: [
        { data: { id: "integration-1", access_token: "grn_secret", last_sync_at: null }, error: null },
        { data: null, error: null },
      ],
      after_call_reviews: [
        { data: [], error: null },
        { data: null, error: null },
      ],
      contacts: [{ data: [{ id: "contact-1", name: "Alex", email: "alex@fund.com", company: "Fund", job_title: "Partner", how_we_met: null, next_steps: null }], error: null }],
    } })

    const response = await sync()
    expect(response.status).toBe(200)
    expect((await response.json()).imported).toBe(1)
    expect(h.inserts).toContainEqual({ table: "after_call_reviews", value: expect.objectContaining({ source: "granola", contact_id: "contact-1" }) })
    expect(h.client.from).not.toHaveBeenCalledWith("commitments")
  })

  it("does not advance the sync watermark while more notes remain", async () => {
    h.list.mockResolvedValue({ notes: [note], hasMore: true, cursor: null })
    h.get.mockResolvedValue(note)
    h.convert.mockReturnValue("Alex agreed that I should send the investor deck by Friday.")
    h.analyze.mockResolvedValue({ summary: "Send deck", contactPatch: {}, commitments: [], followUpDraft: null })
    h.client = perTableSupabase({ results: {
      integrations: [{ data: { id: "integration-1", access_token: "grn_secret", last_sync_at: null }, error: null }],
      after_call_reviews: [
        { data: [], error: null },
        { data: null, error: null },
      ],
      contacts: [{ data: [], error: null }],
    } })

    const response = await sync()
    expect(response.status).toBe(200)
    expect((await response.json()).has_more).toBe(true)
    expect(h.client.from).toHaveBeenCalledWith("integrations")
    const integrationBuilders = h.client.from.mock.results
      .filter((result) => result.value && typeof result.value === "object")
      .map((result) => result.value as { update?: ReturnType<typeof vi.fn> })
    expect(integrationBuilders.every((builder) => !builder.update || builder.update.mock.calls.length === 0)).toBe(true)
  })
})
