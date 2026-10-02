import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"

type Integration = { id: string; user_id: string; access_token: string | null; last_sync_at: string | null }

const h = vi.hoisted(() => ({
  integrations: [] as Integration[],
  updates: [] as Array<{ id: string; patch: Record<string, unknown> }>,
  plans: {} as Record<string, string>,
  sync: vi.fn(),
  sendPush: vi.fn(async () => ({ sent: 1, removed: 0 })),
  order: [] as unknown[],
}))

function service() {
  return {
    from: vi.fn(() => {
      let patch: Record<string, unknown> | null = null
      const b: Record<string, unknown> = {}
      b.select = vi.fn(() => b)
      b.order = vi.fn((...args: unknown[]) => { h.order.push(args); return b })
      b.limit = vi.fn(async () => ({ data: h.integrations, error: null }))
      b.update = vi.fn((p: Record<string, unknown>) => { patch = p; return b })
      b.eq = vi.fn((col: string, value: string) => {
        if (patch && col === "id") h.updates.push({ id: value, patch })
        return patch ? Promise.resolve({ error: null }) : b
      })
      return b
    }),
    auth: { admin: { getUserById: vi.fn(async (id: string) => ({ data: { user: { id, email: `${id}@example.com` } } })) } },
  }
}

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn(async () => service()) }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 2, remaining: 1, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock("@/lib/subscription", () => ({ getUserPlan: vi.fn(async (id: string) => h.plans[id] ?? "pro") }))
vi.mock("@/lib/granola-sync", () => ({ syncGranolaForUser: h.sync }))
vi.mock("@/lib/push/send", () => ({ sendPushToUser: h.sendPush }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { GET } from "@/app/api/cron/granola-sync/route"
import { revalidatePath } from "next/cache"

const URL = "http://localhost/api/cron/granola-sync"
const authed = () => GET(buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } }))
const env = { ...process.env }
const integration = (user_id: string, extra: Partial<Integration> = {}): Integration => ({
  id: `int-${user_id}`, user_id, access_token: "grn_key", last_sync_at: null, ...extra,
})

describe("GET /api/cron/granola-sync (nightly)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret"
    h.integrations = []
    h.updates = []
    h.plans = {}
    h.order = []
    h.sync.mockReset()
    h.sendPush.mockClear()
    vi.mocked(revalidatePath).mockClear()
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it("rejects calls without the cron secret", async () => {
    expect((await GET(buildRequest({ url: URL }))).status).toBe(401)
    expect((await GET(buildRequest({ url: URL, headers: { authorization: "Bearer wrong" } }))).status).toBe(401)
    expect(h.sync).not.toHaveBeenCalled()
  })

  it("imports each Pro user's new notes and nudges their phone about them", async () => {
    h.integrations = [integration("ana"), integration("ben")]
    h.sync.mockImplementation(async (_s: unknown, user: { id: string }) =>
      ({ imported: user.id === "ana" ? 3 : 0, skipped: 1, failed: 0, hasMore: false }))
    const body = await (await authed()).json()
    expect(body).toMatchObject({ success: true, synced: 2, imported: 3, failed: 0 })
    expect(h.sync).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "ana", email: "ana@example.com" }), expect.objectContaining({ id: "int-ana", access_token: "grn_key" }))
    expect(h.sendPush).toHaveBeenCalledTimes(1)
    expect(h.sendPush).toHaveBeenCalledWith(expect.anything(), "ana", expect.objectContaining({ url: "/inbox", body: expect.stringContaining("3") }))
    expect(revalidatePath).toHaveBeenCalledWith("/inbox")
  })

  it("rotates fairly: least recently attempted first, and stamps every attempt", async () => {
    h.integrations = [integration("ana")]
    h.sync.mockResolvedValue({ imported: 0, skipped: 0, failed: 0, hasMore: false })
    await authed()
    expect(h.order).toContainEqual(["last_attempt_at", { ascending: true, nullsFirst: true }])
    expect(h.updates).toContainEqual({ id: "int-ana", patch: { last_attempt_at: expect.any(String) } })
  })

  it("skips users who dropped to the free plan", async () => {
    h.integrations = [integration("ana")]
    h.plans.ana = "free"
    const body = await (await authed()).json()
    expect(h.sync).not.toHaveBeenCalled()
    expect(body.synced).toBe(0)
    expect(h.updates).toContainEqual({ id: "int-ana", patch: { last_sync_error: "Plan does not include Granola sync" } })
  })

  it("records one user's failure (e.g. a revoked key) and keeps going", async () => {
    h.integrations = [integration("ana"), integration("ben")]
    h.sync.mockImplementation(async (_s: unknown, user: { id: string }) => {
      if (user.id === "ana") throw new Error("Granola rejected this API key")
      return { imported: 1, skipped: 0, failed: 0, hasMore: false }
    })
    const body = await (await authed()).json()
    expect(body).toMatchObject({ synced: 1, imported: 1, failed: 1 })
    expect(h.updates).toContainEqual({ id: "int-ana", patch: { last_sync_error: "Granola rejected this API key" } })
    expect(h.updates).toContainEqual({ id: "int-ben", patch: { last_sync_error: null } })
  })

  it("does no work when nothing is connected", async () => {
    const body = await (await authed()).json()
    expect(body).toMatchObject({ success: true, synced: 0, imported: 0 })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
