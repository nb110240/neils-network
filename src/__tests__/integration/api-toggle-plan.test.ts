import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.supabase),
  createServiceClient: vi.fn(async () => h.supabase),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({
    success: true,
    limit: 100,
    remaining: 99,
    reset: Date.now() + 60_000,
  })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { POST } from "@/app/api/dev/toggle-plan/route"

describe("POST /api/dev/toggle-plan", () => {
  const originalDevSecret = process.env.DEV_SECRET

  beforeEach(() => {
    process.env.DEV_SECRET = "test-dev-secret"
  })

  afterEach(() => {
    if (originalDevSecret === undefined) delete process.env.DEV_SECRET
    else process.env.DEV_SECRET = originalDevSecret
  })

  it("rejects requests without dev access with 403", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "notadmin@example.com" } })
    const res = await POST(
      postRequest("http://localhost/api/dev/toggle-plan", { userId: "u1", plan: "pro" })
    )
    expect(res.status).toBe(403)
  })

  it("toggles a plan to pro on the happy path with a valid dev secret", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "test@example.com" } })
    const res = await POST(
      postRequest(
        "http://localhost/api/dev/toggle-plan",
        { userId: "u1", plan: "pro" },
        { "x-dev-secret": "test-dev-secret" }
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.plan).toBe("pro")
  })

  it("toggles a plan to free on the happy path", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "test@example.com" } })
    const res = await POST(
      postRequest(
        "http://localhost/api/dev/toggle-plan",
        { userId: "u1", plan: "free" },
        { "x-dev-secret": "test-dev-secret" }
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.plan).toBe("free")
  })

  it("returns 400 when userId is missing", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "test@example.com" } })
    const res = await POST(
      postRequest(
        "http://localhost/api/dev/toggle-plan",
        { plan: "pro" },
        { "x-dev-secret": "test-dev-secret" }
      )
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for an invalid plan value", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "test@example.com" } })
    const res = await POST(
      postRequest(
        "http://localhost/api/dev/toggle-plan",
        { userId: "u1", plan: "enterprise" },
        { "x-dev-secret": "test-dev-secret" }
      )
    )
    expect(res.status).toBe(400)
  })
})
