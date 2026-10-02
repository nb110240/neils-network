import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"

type Result = { data: unknown; error: null | { message: string; code?: string } }

const h = vi.hoisted(() => ({
  client: null as ReturnType<typeof perTableSupabase> | null,
  plan: "pro" as "free" | "pro" | "team",
  inserts: [] as unknown[],
  updates: [] as unknown[],
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => h.client) }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock("@/lib/subscription", () => ({ getUserPlan: vi.fn(async () => h.plan) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { POST as createRequest } from "@/app/api/intro-requests/route"
import { GET as getPaths } from "@/app/api/intro-requests/paths/route"
import { PATCH } from "@/app/api/intro-requests/[id]/route"

const TARGET = "11111111-1111-4111-8111-111111111111"
const CONNECTOR = "22222222-2222-4222-8222-222222222222"
const REQUEST_ID = "33333333-3333-4333-8333-333333333333"
const validCreate = {
  target_contact_id: TARGET,
  connector_contact_id: CONNECTOR,
  reason: "Their seed thesis matches our round.",
  path_evidence: "Worked together at Acme.",
  path_confidence: "verified",
  strength_score: 90,
}

function perTableSupabase(options: { user?: { id: string; email?: string } | null; results?: Record<string, Result[]> } = {}) {
  const queued = Object.fromEntries(Object.entries(options.results || {}).map(([key, value]) => [key, [...value]]))
  return {
    from: vi.fn((table: string) => {
      const result = queued[table]?.shift() || { data: null, error: null }
      const builder: Record<string, unknown> = {}
      for (const method of ["select", "insert", "update", "delete", "eq", "is", "in", "or", "order", "limit", "range"]) {
        builder[method] = vi.fn((value: unknown) => {
          if (method === "insert") h.inserts.push(value)
          if (method === "update") h.updates.push(value)
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

describe("warm introduction APIs", () => {
  beforeEach(() => {
    h.plan = "pro"
    h.inserts = []
    h.updates = []
    h.client = perTableSupabase()
  })

  it("gates creation before querying contact data on free accounts", async () => {
    h.plan = "free"
    const response = await createRequest(buildRequest({ method: "POST", body: validCreate }))
    expect(response.status).toBe(403)
    expect(h.client!.from).not.toHaveBeenCalled()
  })

  it("requires both the target and connector to belong to the user", async () => {
    h.client = perTableSupabase({ results: { contacts: [{ data: [{ id: TARGET, name: "Target" }], error: null }] } })
    const response = await createRequest(buildRequest({ method: "POST", body: validCreate }))
    expect(response.status).toBe(404)
    expect(h.inserts).toEqual([])
  })

  it("creates a draft record but never sends the introduction", async () => {
    h.client = perTableSupabase({ results: {
      contacts: [{ data: [{ id: TARGET, name: "Alex" }, { id: CONNECTOR, name: "Jordan" }], error: null }],
      intro_requests: [{ data: { id: REQUEST_ID, status: "draft", ...validCreate }, error: null }],
    } })
    const response = await createRequest(buildRequest({ method: "POST", body: validCreate }))
    expect(response.status).toBe(201)
    expect(h.inserts).toEqual([expect.objectContaining({ user_id: "user-1", target_contact_id: TARGET })])
    expect(h.inserts[0]).not.toHaveProperty("status")
    expect(h.client!.from).not.toHaveBeenCalledWith("contact_activities")
  })

  it("does not expose paths for a target outside the authenticated account", async () => {
    h.client = perTableSupabase({ results: { contacts: [{ data: [], error: null }] } })
    const response = await getPaths(buildRequest({ url: `http://localhost/api/intro-requests/paths?target_id=${TARGET}` }))
    expect(response.status).toBe(404)
  })

  it("finds paths to a target past the API's 1,000-row page (regression)", async () => {
    const filler = Array.from({ length: 1000 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      name: `Filler ${i}`,
      company: null, job_title: null, how_we_met: null, next_steps: null, raw_note: null,
      last_contact_date: null, created_at: "2026-01-01T00:00:00Z",
    }))
    const target = { ...filler[0], id: TARGET, name: "Maya Chen", company: "Northwind Ventures" }
    const connector = { ...filler[0], id: CONNECTOR, name: "Sam Ortiz", raw_note: "Sam worked with Maya Chen at Northwind." }
    h.client = perTableSupabase({ results: {
      contacts: [{ data: filler, error: null }, { data: [target, connector], error: null }],
      contact_tags: [{ data: [], error: null }],
    } })
    const response = await getPaths(buildRequest({ url: `http://localhost/api/intro-requests/paths?target_id=${TARGET}` }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.target.id).toBe(TARGET)
    expect(body.paths[0].connector.id).toBe(CONNECTOR)
  })

  it("owner-scopes status updates and assigns a follow-up timestamp", async () => {
    h.client = perTableSupabase({ results: {
      intro_requests: [{ data: { id: REQUEST_ID, user_id: "user-1", status: "requested" }, error: null }],
    } })
    const response = await PATCH(
      buildRequest({ method: "PATCH", body: { status: "requested" } }),
      { params: Promise.resolve({ id: REQUEST_ID }) }
    )
    expect(response.status).toBe(200)
    expect(h.updates[0]).toEqual(expect.objectContaining({ status: "requested", requested_at: expect.any(String), next_follow_up_at: expect.any(String) }))
  })
})
