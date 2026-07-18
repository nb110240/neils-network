import { beforeEach, describe, expect, it, vi } from "vitest"

type Result = { data: unknown; error: null | { message: string } }

const h = vi.hoisted(() => ({
  userClient: null as ReturnType<typeof tableClient> | null,
  serviceClient: null as ReturnType<typeof tableClient> | null,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.userClient),
  createServiceClient: vi.fn(async () => h.serviceClient),
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

import { GET } from "@/app/api/settings/export/route"

function tableClient(options: {
  user?: { id: string; email?: string } | null
  results?: Record<string, Result>
} = {}) {
  return {
    from: vi.fn((table: string) => {
      const result = options.results?.[table] || { data: [], error: null }
      const builder: Record<string, unknown> = {}
      for (const method of ["select", "eq"]) builder[method] = vi.fn(() => builder)
      builder.maybeSingle = vi.fn(async () => result)
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve)
      return builder
    }),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user === undefined ? { id: "user-1", email: "founder@savvo.app" } : options.user },
      })),
    },
  }
}

describe("GET /api/settings/export", () => {
  beforeEach(() => {
    h.userClient = tableClient()
    h.serviceClient = tableClient({ results: {
      integrations: { data: [{ id: "int-1", provider: "granola", created_at: "2026-07-17", last_sync_at: null }], error: null },
      usage_counters: { data: { ai_reviews_used: 2, csv_contacts_imported: 5 }, error: null },
    } })
  })

  it("requires authentication", async () => {
    h.userClient = tableClient({ user: null })
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it("exports non-secret integration metadata and lifetime usage through the service client", async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.integrations).toEqual([expect.objectContaining({ provider: "granola" })])
    expect(body.free_usage).toEqual({ ai_reviews_used: 2, csv_contacts_imported: 5 })
    expect(JSON.stringify(body)).not.toContain("access_token")
    expect(h.serviceClient?.from).toHaveBeenCalledWith("integrations")
    expect(h.serviceClient?.from).toHaveBeenCalledWith("usage_counters")
    expect(h.userClient?.from).not.toHaveBeenCalledWith("integrations")
  })

  it("fails closed when a required export query errors", async () => {
    h.userClient = tableClient({ results: {
      contacts: { data: null, error: { message: "database unavailable" } },
    } })
    const response = await GET()
    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe("Failed to export data")
  })
})
