import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
// vi.mock is hoisted above imports; the factories read from a hoisted holder
// so each test can swap the Supabase client.
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

vi.mock("@/lib/openai", () => ({
  buildContactEmbeddingText: vi.fn(() => "embedding text"),
}))

// `after()` requires a Next.js request scope that doesn't exist in the
// vitest environment. Keep the rest of next/server real and stub `after`
// to invoke its callback inline so the route's happy path can be tested.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")
  return {
    ...actual,
    after: vi.fn((cb: () => unknown) => {
      if (typeof cb === "function") void cb()
    }),
  }
})

import { POST } from "@/app/api/dev/re-embed/route"

describe("POST /api/dev/re-embed", () => {
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
    const res = await POST(postRequest("http://localhost/api/dev/re-embed", {}) as never)
    expect(res.status).toBe(403)
  })

  it("re-embeds contacts on the happy path with a valid dev secret", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1", email: "test@example.com" },
      queryResult: { data: [{ id: "c1", name: "Ada", raw_note: "note" }], error: null },
    })
    const res = await POST(
      postRequest("http://localhost/api/dev/re-embed", {}, { "x-dev-secret": "test-dev-secret" }) as never
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.count).toBe(1)
  })

  it("returns count 0 when the user has no contacts", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1", email: "test@example.com" },
      queryResult: { data: [], error: null },
    })
    const res = await POST(
      postRequest("http://localhost/api/dev/re-embed", {}, { "x-dev-secret": "test-dev-secret" }) as never
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.count).toBe(0)
    expect(json.message).toBe("No contacts to embed")
  })

  it("returns 401 when no authenticated user is present", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(
      postRequest("http://localhost/api/dev/re-embed", {}, { "x-dev-secret": "test-dev-secret" }) as never
    )
    expect(res.status).toBe(401)
  })
})
