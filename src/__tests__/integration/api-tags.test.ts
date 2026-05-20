import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
// vi.mock is hoisted above imports; the factories read from a hoisted holder
// so each test can swap the Supabase client and rate-limit verdict.
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
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

import { POST } from "@/app/api/tags/route"

describe("POST /api/tags", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest("http://localhost/api/tags", { name: "VIP" }))
    expect(res.status).toBe(401)
  })

  it("rejects an empty tag name with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest("http://localhost/api/tags", { name: "" }))
    expect(res.status).toBe(400)
  })

  it("rejects an invalid hex color with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    const res = await POST(postRequest("http://localhost/api/tags", { name: "VIP", color: "red" }))
    expect(res.status).toBe(400)
  })

  it("creates a tag for an authenticated user", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: "t1", name: "VIP", color: "#78716c", created_by: "u1" }, error: null },
    })
    const res = await POST(postRequest("http://localhost/api/tags", { name: "VIP" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.tag.name).toBe("VIP")
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest("http://localhost/api/tags", { name: "VIP" }))
    expect(res.status).toBe(429)
  })

  it("returns 409 on a duplicate tag name", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: null, error: { message: "duplicate key", code: "23505" } },
    })
    const res = await POST(postRequest("http://localhost/api/tags", { name: "VIP" }))
    expect(res.status).toBe(409)
  })
})
