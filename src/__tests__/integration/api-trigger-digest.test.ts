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

import { POST } from "@/app/api/dev/trigger-digest/route"

describe("POST /api/dev/trigger-digest", () => {
  const originalDevSecret = process.env.DEV_SECRET
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.DEV_SECRET = "test-dev-secret"
  })

  afterEach(() => {
    if (originalDevSecret === undefined) delete process.env.DEV_SECRET
    else process.env.DEV_SECRET = originalDevSecret
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("rejects requests without dev access with 403", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "notadmin@example.com" } })
    const res = await POST(postRequest("http://localhost/api/dev/trigger-digest", {}) as never)
    expect(res.status).toBe(403)
  })

  it("triggers the digest and forwards the response on the happy path", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "test@example.com" } })
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ sent: 3, ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ) as typeof fetch

    const res = await POST(
      postRequest("http://localhost/api/dev/trigger-digest", {}, { "x-dev-secret": "test-dev-secret" }) as never
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.sent).toBe(3)
    expect(json.ok).toBe(true)
  })

  it("calls the same-origin daily-digest cron endpoint", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "test@example.com" } })
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
    globalThis.fetch = fetchMock as typeof fetch

    await POST(
      postRequest("http://localhost/api/dev/trigger-digest", {}, { "x-dev-secret": "test-dev-secret" }) as never
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost/api/cron/daily-digest",
      expect.objectContaining({ headers: expect.any(Object) })
    )
  })

  it("returns 500 when the downstream fetch throws", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "test@example.com" } })
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down")
    }) as typeof fetch

    const res = await POST(
      postRequest("http://localhost/api/dev/trigger-digest", {}, { "x-dev-secret": "test-dev-secret" }) as never
    )
    expect(res.status).toBe(500)
  })
})
