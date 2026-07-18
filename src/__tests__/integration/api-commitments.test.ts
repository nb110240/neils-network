import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"
import { createMockSupabase } from "../helpers/mock-supabase"

const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof createMockSupabase> | null,
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => h.supabase) }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 60, remaining: 59, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { PATCH } from "@/app/api/commitments/[id]/route"

const ID = "11111111-1111-4111-8111-111111111111"
const CONTACT_ID = "22222222-2222-4222-8222-222222222222"
const ctx = { params: Promise.resolve({ id: ID }) }

describe("PATCH /api/commitments/:id", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("rejects unauthenticated requests", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const response = await PATCH(buildRequest({ method: "PATCH", body: { status: "completed" } }), ctx)
    expect(response.status).toBe(401)
  })

  it("requires a future point when snoozing", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "user-1" } })
    const response = await PATCH(buildRequest({ method: "PATCH", body: { status: "snoozed" } }), ctx)
    expect(response.status).toBe(400)
    expect(h.supabase._queryBuilder.update).not.toHaveBeenCalled()
  })

  it("scopes completion to the authenticated owner and records completion time", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "user-1" },
      queryResult: { data: { id: ID, contact_id: CONTACT_ID, status: "completed" }, error: null },
    })
    const response = await PATCH(buildRequest({ method: "PATCH", body: { status: "completed" } }), ctx)
    expect(response.status).toBe(200)
    expect(h.supabase._queryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "completed",
      completed_at: expect.any(String),
      snoozed_until: null,
    }))
    expect(h.supabase._queryBuilder.eq).toHaveBeenCalledWith("user_id", "user-1")
  })

  it("returns 404 when the commitment is not owned by the requester", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "user-1" },
      queryResult: { data: null, error: null },
    })
    const response = await PATCH(buildRequest({ method: "PATCH", body: { status: "completed" } }), ctx)
    expect(response.status).toBe(404)
  })
})
