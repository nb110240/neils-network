import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
// vi.mock is hoisted above imports; factories read from a hoisted holder
// so each test can swap the Supabase client, rate-limit verdict, and plan.
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

// The draft route gates AI features on a Pro plan via getUserPlan.
vi.mock("@/lib/subscription", () => ({
  getUserPlan: vi.fn(async () => h.plan),
}))

import { POST } from "@/app/api/contacts/[id]/draft/route"

const VALID_ID = "11111111-1111-4111-8111-111111111111"
const params = (id = VALID_ID) => ({ params: Promise.resolve({ id }) })

// A plausible OpenAI chat-completions shaped response.
function openAiResponse(content = "Hey Sam — great chatting at the conference. Coffee next week?") {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "content-type": "application/json" } }
  )
}

describe("POST /api/contacts/[id]/draft", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.plan = "pro"
    vi.unstubAllGlobals()
  })

  it("rejects an invalid contact ID with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "neil@savvo.app" } })
    const res = await POST(postRequest("http://localhost/api/contacts/bad/draft", { type: "follow-up" }), params("not-a-uuid"))
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest("http://localhost/api/contacts/x/draft", { type: "follow-up" }), params())
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "neil@savvo.app" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest("http://localhost/api/contacts/x/draft", { type: "follow-up" }), params())
    expect(res.status).toBe(429)
  })

  it("returns 403 for free-plan users (AI is Pro-only)", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "neil@savvo.app" } })
    h.plan = "free"
    const res = await POST(postRequest("http://localhost/api/contacts/x/draft", { type: "follow-up" }), params())
    expect(res.status).toBe(403)
  })

  it("returns 404 when the contact is not found", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1", email: "neil@savvo.app" },
      queryResult: { data: null, error: null },
    })
    const res = await POST(postRequest("http://localhost/api/contacts/x/draft", { type: "follow-up" }), params())
    expect(res.status).toBe(404)
  })

  it("generates a follow-up draft with the OpenAI call mocked", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1", email: "neil@savvo.app" },
      queryResult: {
        data: { id: VALID_ID, name: "Sam Lee", company: "Plaid", job_title: "Founder", created_by: "u1" },
        error: null,
      },
    })
    const fetchMock = vi.fn(async () => openAiResponse())
    vi.stubGlobal("fetch", fetchMock)

    const res = await POST(postRequest("http://localhost/api/contacts/x/draft", { type: "follow-up" }), params())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.draft).toContain("Coffee")
    expect(json.type).toBe("follow-up")
    expect(fetchMock).toHaveBeenCalled()
  })

  it("generates a meeting draft (tolerates calendar lookup failure)", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1", email: "neil@savvo.app" },
      queryResult: {
        data: { id: VALID_ID, name: "Sam Lee", company: "Plaid", job_title: "Founder", created_by: "u1" },
        error: null,
      },
    })
    // First fetch (calendar freeBusy) is allowed to fail; route catches it.
    // All fetches return an OpenAI-shaped payload — harmless for the calendar branch.
    const fetchMock = vi.fn(async () => openAiResponse())
    vi.stubGlobal("fetch", fetchMock)

    const res = await POST(postRequest("http://localhost/api/contacts/x/draft", { type: "meeting" }), params())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.type).toBe("meeting")
  })

  it("returns 500 when the OpenAI call fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1", email: "neil@savvo.app" },
      queryResult: {
        data: { id: VALID_ID, name: "Sam Lee", company: "Plaid", created_by: "u1" },
        error: null,
      },
    })
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream error", { status: 502 })))

    const res = await POST(postRequest("http://localhost/api/contacts/x/draft", { type: "follow-up" }), params())
    expect(res.status).toBe(500)
  })
})
