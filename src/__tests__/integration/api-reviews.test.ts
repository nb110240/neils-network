import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"

type Result = { data: unknown; error: null | { message: string; code?: string }; count?: number }

const h = vi.hoisted(() => ({
  client: null as ReturnType<typeof perTableSupabase> | null,
  plan: "pro" as "free" | "pro" | "team",
  analysis: vi.fn(),
  calls: [] as string[],
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
vi.mock("@/lib/action-extraction", () => ({ analyzeInteraction: h.analysis }))
vi.mock("@/lib/openai", () => ({
  buildContactEmbeddingText: vi.fn(() => "contact context"),
  generateEmbedding: vi.fn(async () => null),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { POST as analyze } from "@/app/api/reviews/analyze/route"
import { POST as approve } from "@/app/api/reviews/[id]/approve/route"

const REVIEW_ID = "11111111-1111-4111-8111-111111111111"
const CONTACT_ID = "22222222-2222-4222-8222-222222222222"
const ctx = { params: Promise.resolve({ id: REVIEW_ID }) }

const analysisResult = {
  summary: "Send updated numbers.",
  contactPatch: { name: "Taylor" },
  commitments: [{
    title: "Send the updated metrics",
    direction: "user_owes",
    details: null,
    due_at: null,
    evidence: "Send me the numbers",
    confidence: 0.9,
    priority: 80,
  }],
  followUpDraft: "Taylor, I will send the updated metrics.",
}

const validBody = {
  title: "Northstar call",
  occurred_at: "2026-07-17T10:00:00.000Z",
  raw_text: "Taylor asked that I send the updated metrics after our investor call.",
}

const approveBody = {
  contact_id: CONTACT_ID,
  contact_patch: { name: "Taylor" },
  commitments: analysisResult.commitments,
  follow_up_draft: analysisResult.followUpDraft,
}

function perTableSupabase(options: {
  user?: { id: string; email?: string } | null
  tableResults?: Record<string, Result[]>
  rpcResult?: Result
}) {
  const tableResults = Object.fromEntries(
    Object.entries(options.tableResults || {}).map(([table, results]) => [table, [...results]])
  ) as Record<string, Result[]>
  const methods = ["select", "insert", "update", "delete", "upsert", "eq", "neq", "is", "order", "limit", "in"]
  const client = {
    from: vi.fn((table: string) => {
      const result = tableResults[table]?.shift() || { data: null, error: null }
      const builder: Record<string, unknown> = {}
      for (const method of methods) {
        builder[method] = vi.fn((...args: unknown[]) => {
          if (method === "insert" || method === "update") h.calls.push(`${table}.${method}`)
          return builder
        })
      }
      builder.single = vi.fn(async () => result)
      builder.maybeSingle = vi.fn(async () => result)
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve)
      return builder
    }),
    rpc: vi.fn(async (name: string) => {
      h.calls.push(`rpc.${name}`)
      return options.rpcResult || { data: null, error: null }
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user === undefined ? { id: "user-1", email: "neil@savvo.app" } : options.user } })),
      signOut: vi.fn(async () => ({ error: null })),
      admin: { deleteUser: vi.fn(async () => ({ error: null })) },
    },
  }
  return client
}

describe("POST /api/reviews/analyze", () => {
  beforeEach(() => {
    h.calls = []
    h.plan = "pro"
    h.analysis.mockReset()
  })

  it("rejects unauthenticated requests", async () => {
    h.client = perTableSupabase({ user: null })
    const response = await analyze(buildRequest({ method: "POST", body: validBody }))
    expect(response.status).toBe(401)
  })

  it("rejects malformed notes before invoking analysis", async () => {
    h.client = perTableSupabase({})
    const response = await analyze(buildRequest({ method: "POST", body: { ...validBody, raw_text: "too short" } }))
    expect(response.status).toBe(400)
    expect(h.analysis).not.toHaveBeenCalled()
  })

  it("enforces the atomic lifetime free review limit", async () => {
    h.plan = "free"
    h.client = perTableSupabase({
      tableResults: { after_call_reviews: [{ data: null, error: null }] },
      rpcResult: { data: { allowed: false, used: 3, remaining: 0 }, error: null },
    })
    const response = await analyze(buildRequest({ method: "POST", body: validBody }))
    expect(response.status).toBe(403)
    expect(h.analysis).not.toHaveBeenCalled()
    expect(h.calls).toContain("rpc.reserve_free_ai_review")
  })

  it("reserves one lifetime allowance before analyzing for a free user", async () => {
    h.plan = "free"
    h.analysis.mockResolvedValue(analysisResult)
    h.client = perTableSupabase({
      tableResults: {
        after_call_reviews: [
          { data: null, error: null },
          { data: { id: REVIEW_ID, status: "pending" }, error: null },
        ],
      },
      rpcResult: { data: { allowed: true, used: 1, remaining: 2 }, error: null },
    })
    const response = await analyze(buildRequest({ method: "POST", body: validBody }))
    expect(response.status).toBe(201)
    expect(h.calls).toEqual(["rpc.reserve_free_ai_review", "after_call_reviews.insert"])
  })

  it("rejects a selected contact that is not owned by the requester", async () => {
    h.client = perTableSupabase({ tableResults: { contacts: [{ data: null, error: null }] } })
    const response = await analyze(buildRequest({ method: "POST", body: { ...validBody, contact_id: CONTACT_ID } }))
    expect(response.status).toBe(404)
    expect(h.analysis).not.toHaveBeenCalled()
  })

  it("persists only a pending review after successful analysis", async () => {
    h.analysis.mockResolvedValue(analysisResult)
    h.client = perTableSupabase({
      tableResults: {
        after_call_reviews: [
          { data: null, error: null },
          { data: { id: REVIEW_ID, status: "pending" }, error: null },
        ],
      },
    })

    const response = await analyze(buildRequest({ method: "POST", body: validBody }))
    expect(response.status).toBe(201)
    expect(h.calls).toEqual(["after_call_reviews.insert"])
    expect(h.client!.from).toHaveBeenCalledWith("after_call_reviews")
    expect(h.client!.from).not.toHaveBeenCalledWith("contacts")
    expect(h.client!.from).not.toHaveBeenCalledWith("commitments")
  })
})

describe("POST /api/reviews/:id/approve", () => {
  beforeEach(() => { h.calls = [] })

  it("rejects a review that is not owned by the requester", async () => {
    h.client = perTableSupabase({ tableResults: { after_call_reviews: [{ data: null, error: null }] } })
    const response = await approve(buildRequest({ method: "POST", body: approveBody }), ctx)
    expect(response.status).toBe(404)
    expect(h.client!.rpc).not.toHaveBeenCalled()
  })

  it("rejects invalid approval payloads before any state mutation", async () => {
    h.client = perTableSupabase({})
    const response = await approve(buildRequest({ method: "POST", body: { ...approveBody, commitments: [{ title: "" }] } }), ctx)
    expect(response.status).toBe(400)
    expect(h.client!.rpc).not.toHaveBeenCalled()
  })

  it("saves reviewed proposals before invoking the atomic approval RPC", async () => {
    h.client = perTableSupabase({
      tableResults: {
        after_call_reviews: [
          { data: { id: REVIEW_ID, status: "pending", contact_id: CONTACT_ID }, error: null },
          { data: null, error: null },
        ],
        contacts: [{ data: { id: CONTACT_ID }, error: null }],
      },
      rpcResult: { data: { contact_id: CONTACT_ID, commitments_created: 1, already_approved: true }, error: null },
    })

    const response = await approve(buildRequest({ method: "POST", body: approveBody }), ctx)
    expect(response.status).toBe(200)
    expect(h.calls).toEqual(["after_call_reviews.update", "rpc.approve_after_call_review"])
  })

  it("retries an already-approved review through the idempotent RPC without rewriting its proposal", async () => {
    h.client = perTableSupabase({
      tableResults: {
        after_call_reviews: [{ data: { id: REVIEW_ID, status: "approved", contact_id: CONTACT_ID }, error: null }],
        contacts: [{ data: { id: CONTACT_ID }, error: null }],
      },
      rpcResult: { data: { contact_id: CONTACT_ID, commitments_created: 0, already_approved: true }, error: null },
    })

    const response = await approve(buildRequest({ method: "POST", body: approveBody }), ctx)
    expect(response.status).toBe(200)
    expect(h.calls).toEqual(["rpc.approve_after_call_review"])
  })
})
