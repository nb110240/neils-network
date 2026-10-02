import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"

type Rows = Record<string, unknown[]>

const h = vi.hoisted(() => ({
  db: {} as Record<string, Rows>,
  tokenUsers: [] as string[],
  sendPush: vi.fn(async () => ({ sent: 1, removed: 0 })),
  failUser: null as string | null,
}))

// Table- and user-aware builder: results depend on the user_id/created_by filter.
function service() {
  return {
    from: vi.fn((table: string) => {
      let owner = ""
      let head = false
      const b: Record<string, unknown> = {}
      for (const m of ["order", "gte", "lte", "in", "is", "limit"]) b[m] = vi.fn(() => b)
      b.select = vi.fn((_cols: string, opts?: { head?: boolean }) => {
        head = Boolean(opts?.head)
        return b
      })
      b.range = vi.fn(async () => ({ data: h.tokenUsers.map((user_id) => ({ user_id })), error: null }))
      b.eq = vi.fn((col: string, value: string) => {
        if (col === "user_id" || col === "created_by") owner = value
        return b
      })
      b.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        if (owner === h.failUser) return Promise.reject(new Error("db down")).then(resolve, reject)
        const rows = h.db[owner]?.[table] ?? []
        return Promise.resolve(head ? { count: rows.length, data: null, error: null } : { data: rows, error: null }).then(resolve, reject)
      }
      return b
    }),
  }
}

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn(async () => service()) }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 2, remaining: 1, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock("@/lib/push/send", () => ({ isPushConfigured: vi.fn(() => true), sendPushToUser: h.sendPush }))

import { GET } from "@/app/api/cron/push-moves/route"
import { isPushConfigured } from "@/lib/push/send"

const URL = "http://localhost/api/cron/push-moves"
const authed = () => GET(buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } }))
const env = { ...process.env }

describe("GET /api/cron/push-moves", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret"
    h.db = {}
    h.tokenUsers = []
    h.failUser = null
    h.sendPush.mockClear()
    vi.mocked(isPushConfigured).mockReturnValue(true)
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it("rejects calls without the cron secret", async () => {
    expect((await GET(buildRequest({ url: URL }))).status).toBe(401)
  })

  it("does nothing until push keys are configured", async () => {
    vi.mocked(isPushConfigured).mockReturnValue(false)
    expect(await (await authed()).json()).toEqual({ skipped: "not_configured", sent: 0 })
  })

  it("nudges each device owner about their most urgent promise, skipping archived contacts", async () => {
    h.tokenUsers = ["founder", "founder", "quiet"]
    h.db.founder = {
      commitments: [
        { title: "Send archived thing", contact_id: "gone", due_at: "2026-10-02T09:00:00Z" },
        { title: "Send the deck", contact_id: "maya", due_at: "2026-10-02T17:00:00Z" },
      ],
      // Archived "gone" is filtered out by the query, so only Maya comes back.
      contacts: [{ id: "maya", name: "Maya Chen" }],
      after_call_reviews: [{ id: "r1" }],
    }
    const res = await authed()
    expect(await res.json()).toEqual({ users: 2, sent: 1, failed: 0 })
    expect(h.sendPush).toHaveBeenCalledTimes(1)
    expect(h.sendPush).toHaveBeenCalledWith(expect.anything(), "founder", {
      title: "You promised Maya Chen",
      body: "Send the deck · 1 more move today",
      url: "/contact/maya",
      threadId: "daily-moves",
    })
  })

  it("keeps going when one user's queries fail", async () => {
    h.tokenUsers = ["broken", "ok"]
    h.failUser = "broken"
    h.db.ok = { after_call_reviews: [{ id: "r1" }, { id: "r2" }] }
    expect(await (await authed()).json()).toEqual({ users: 2, sent: 1, failed: 1 })
    expect(h.sendPush).toHaveBeenCalledWith(expect.anything(), "ok", expect.objectContaining({ title: "Meeting notes to review" }))
  })
})
