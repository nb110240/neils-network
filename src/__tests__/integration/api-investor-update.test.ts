import { describe, it, expect, vi, beforeEach } from "vitest"
import { postRequest, buildRequest } from "../helpers/mock-request"

// ─── Table-aware Supabase mock ───
// The route reads several tables in parallel, so each `.from(table)` gets its
// own chainable builder that resolves to that table's rows and records calls.
type Rows = Record<string, unknown[]>

function createTableMock(authUser: { id: string; email?: string } | null, rows: Rows = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {}
    for (const method of ["select", "eq", "is", "gte", "lte", "in", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return builder
      }
    }
    Object.defineProperty(builder, "then", {
      value: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve),
    })
    return builder
  })
  return {
    from,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: authUser } }) },
    calls,
  }
}

const h = vi.hoisted(() => ({
  supabase: null as unknown,
  rateLimitSuccess: true,
  plan: "pro" as string,
  structured: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.supabase),
  createServiceClient: vi.fn(async () => h.supabase),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: h.rateLimitSuccess, limit: 20, remaining: 19, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock("@/lib/subscription", () => ({ getUserPlan: vi.fn(async () => h.plan) }))
vi.mock("@/lib/openai", () => ({ generateStructuredOutput: h.structured }))

import { POST } from "@/app/api/investor-update/route"

const URL = "http://localhost/api/investor-update"
const USER = { id: "u1", email: "neil@savvo.app" }
const recent = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

function crm(): Rows {
  return {
    // The DB applies `.is("archived_at", null)`, so archived contacts never come back.
    contacts: [
      { id: "c1", name: "Sarah Chen", company: "Sequoia", investor_stage: "first_meeting" },
      { id: "c2", name: "Marcus Webb", company: "a16z", investor_stage: "committed" },
    ],
    contact_activities: [
      { contact_id: "c1", type: "meeting", occurred_at: recent(3) },
      { contact_id: "c2", type: "meeting", occurred_at: recent(9) },
      // Belongs to an archived contact: must not be counted.
      { contact_id: "archived-1", type: "meeting", occurred_at: recent(1) },
    ],
    commitments: [
      { id: "k1", contact_id: "c1", direction: "user_owes", status: "completed", due_at: null, completed_at: recent(2) },
      { id: "k2", contact_id: "archived-1", direction: "user_owes", status: "completed", due_at: null, completed_at: recent(2) },
    ],
    intro_requests: [
      { id: "i1", target_contact_id: "c1", status: "requested", introduced_at: null, meeting_booked_at: null },
      { id: "i2", target_contact_id: "archived-1", status: "requested", introduced_at: null, meeting_booked_at: null },
    ],
  }
}

describe("POST /api/investor-update", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
    h.structured.mockReset()
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createTableMock(null)
    const res = await POST(postRequest(URL, {}))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createTableMock(USER)
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, {}))
    expect(res.status).toBe(429)
  })

  it("returns 403 for free-plan users", async () => {
    h.supabase = createTableMock(USER)
    h.plan = "free"
    const res = await POST(postRequest(URL, {}))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/Pro/)
    expect(h.structured).not.toHaveBeenCalled()
  })

  it.each([
    [{ period_days: 3 }],
    [{ period_days: 91 }],
    [{ tone: "loud" }],
    [{ highlights: "x".repeat(2001) }],
    [{ extra: "field" }],
  ])("returns 400 for invalid body %j", async (body) => {
    h.supabase = createTableMock(USER)
    const res = await POST(postRequest(URL, body))
    expect(res.status).toBe(400)
    expect(await res.json()).toHaveProperty("error")
  })

  it("returns 400 for malformed JSON", async () => {
    h.supabase = createTableMock(USER)
    const res = await POST(buildRequest({ method: "POST", url: URL, body: "{not json", headers: { "content-type": "application/json" } }))
    expect(res.status).toBe(400)
  })

  it("drafts an update with the model and returns stats", async () => {
    const mock = createTableMock(USER, crm())
    h.supabase = mock
    h.structured.mockResolvedValue({ draft: "TL;DR\n- Strong month — 2 investor meetings\n\nHighlights\n- Hit $50k MRR" })

    const res = await POST(postRequest(URL, { period_days: 30, highlights: "Hit $50k MRR", asks: "Fintech angels", tone: "detailed" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.fallback).toBe(false)
    expect(json.draft).toContain("TL;DR")
    expect(json.draft).not.toContain("—")
    expect(json.stats.stages).toEqual({ first_meeting: 1, committed: 1 })
    expect(json.stats.meetings.count).toBe(2)

    const prompt = h.structured.mock.calls[0][0].user as string
    expect(prompt).toContain("<user_data>Hit $50k MRR</user_data>")
    expect(prompt).toContain("Detailed")
    for (const identity of ["Sarah", "Chen", "Sequoia", "Marcus", "a16z"]) {
      expect(prompt).not.toContain(identity)
    }
  })

  it("accepts an empty body with defaults", async () => {
    h.supabase = createTableMock(USER, crm())
    h.structured.mockResolvedValue({ draft: "TL;DR\n- ok" })
    const res = await POST(buildRequest({ method: "POST", url: URL }))
    expect(res.status).toBe(200)
    expect((await res.json()).stats.period_days).toBe(30)
  })

  it("falls back to a template when OpenAI throws", async () => {
    h.supabase = createTableMock(USER, crm())
    h.structured.mockRejectedValue(new Error("AI analysis failed (500)"))

    const res = await POST(postRequest(URL, { highlights: "Hired a CTO" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.fallback).toBe(true)
    for (const heading of ["TL;DR", "Highlights", "Fundraising progress", "Asks", "What's next"]) {
      expect(json.draft).toContain(heading)
    }
    expect(json.draft).toContain("- Hired a CTO")
    expect(json.draft).toContain("2 investor meetings")
  })

  it("excludes archived contacts from the query and from every count", async () => {
    const mock = createTableMock(USER, crm())
    h.supabase = mock
    h.structured.mockResolvedValue({ draft: "TL;DR" })

    const res = await POST(postRequest(URL, {}))
    const json = await res.json()

    expect(mock.calls).toContainEqual({ table: "contacts", method: "is", args: ["archived_at", null] })
    expect(json.stats.meetings.count).toBe(2)
    expect(json.stats.commitments.completed).toBe(1)
    expect(json.stats.intros.in_progress).toBe(1)
  })

  it("never selects PII columns", async () => {
    const mock = createTableMock(USER, crm())
    h.supabase = mock
    h.structured.mockResolvedValue({ draft: "TL;DR" })
    await POST(postRequest(URL, {}))
    const selects = mock.calls.filter((c) => c.method === "select").map((c) => String(c.args[0]))
    for (const columns of selects) {
      expect(columns).not.toMatch(/\*|\bname\b|company|email|phone|raw_note|content|notes/)
    }
  })
})
