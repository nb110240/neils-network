import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  plan: "pro" as string,
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

// The prep route gates AI features on a Pro plan via getUserPlan.
vi.mock("@/lib/subscription", () => ({
  getUserPlan: vi.fn(async () => h.plan),
}))

import { POST } from "@/app/api/contacts/[id]/prep/route"

const VALID_ID = "11111111-1111-4111-8111-111111111111"
const params = (id = VALID_ID) => ({ params: Promise.resolve({ id }) })

function openAiResponse(content = "1. Key Context\n- Met at TechCrunch") {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "content-type": "application/json" } }
  )
}

describe("POST /api/contacts/[id]/prep", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
    vi.unstubAllGlobals()
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "neil@savvo.app" } })
    const res = await POST(postRequest("http://localhost/api/contacts/bad/prep", {}), params("not-a-uuid"))
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest("http://localhost/api/contacts/x/prep", {}), params())
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "neil@savvo.app" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest("http://localhost/api/contacts/x/prep", {}), params())
    expect(res.status).toBe(429)
  })

  it("returns 403 for free-plan users (AI is Pro-only)", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "neil@savvo.app" } })
    h.plan = "free"
    const res = await POST(postRequest("http://localhost/api/contacts/x/prep", {}), params())
    expect(res.status).toBe(403)
  })

  it("returns 404 when the contact is not found", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1", email: "neil@savvo.app" },
      queryResult: { data: null, error: null },
    })
    const res = await POST(postRequest("http://localhost/api/contacts/x/prep", {}), params())
    expect(res.status).toBe(404)
  })

  it("generates a meeting prep brief with the OpenAI call mocked", async () => {
    // The contact is fetched via .single(); activities/tags are fetched via the
    // thenable builder. Override the thenable to return arrays so the route's
    // list handling (.map over activities/tags) works.
    h.supabase = createMockSupabase({
      authUser: { id: "u1", email: "neil@savvo.app" },
      queryResult: {
        data: {
          id: VALID_ID,
          name: "Sam Lee",
          company: null,
          job_title: "Founder",
          how_we_met: "TechCrunch",
          last_contact_date: "2026-04-01",
          created_at: "2026-01-01",
          raw_note: "Sharp founder, interested in fintech.",
          next_steps: "Intro to investor",
          created_by: "u1",
        },
        error: null,
      },
    })
    Object.defineProperty(h.supabase._queryBuilder, "then", {
      value: (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
      configurable: true,
    })
    vi.stubGlobal("fetch", vi.fn(async () => openAiResponse()))

    const res = await POST(postRequest("http://localhost/api/contacts/x/prep", {}), params())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.brief).toContain("Key Context")
    expect(json.contactName).toBe("Sam Lee")
  })

  it("returns 500 when the OpenAI call fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1", email: "neil@savvo.app" },
      queryResult: {
        data: {
          id: VALID_ID,
          name: "Sam Lee",
          company: null,
          created_at: "2026-01-01",
          raw_note: "note",
          created_by: "u1",
        },
        error: null,
      },
    })
    Object.defineProperty(h.supabase._queryBuilder, "then", {
      value: (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
      configurable: true,
    })
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream error", { status: 502 })))

    const res = await POST(postRequest("http://localhost/api/contacts/x/prep", {}), params())
    expect(res.status).toBe(500)
  })
})
