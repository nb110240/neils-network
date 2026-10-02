import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { buildRequest } from "../helpers/mock-request"

const h = vi.hoisted(() => ({
  supabase: null as unknown,
  sendDigestEmail: vi.fn(async () => undefined),
  sendNewUserNudgeEmail: vi.fn(async () => undefined),
  sendActivationEmail: vi.fn<(...args: unknown[]) => Promise<undefined>>(async () => undefined),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => h.supabase),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 2, remaining: 1, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock("@/lib/email", () => ({
  sendDigestEmail: h.sendDigestEmail,
  sendNewUserNudgeEmail: h.sendNewUserNudgeEmail,
  sendActivationEmail: h.sendActivationEmail,
}))

import { GET } from "@/app/api/cron/daily-digest/route"

const URL = "http://localhost/api/cron/daily-digest"

function makeUser(id: string) {
  return {
    id,
    email: `${id}@example.com`,
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  }
}

function makeContacts(userId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${userId}-c${i}`,
    name: `Contact ${i}`,
    company: null,
    job_title: null,
    how_we_met: null,
    next_steps: null,
    last_contact_date: "2026-01-01",
    created_at: "2026-01-01T00:00:00Z",
    follow_up_needed: false,
    cadence_days: null,
    snoozed_until: null,
    next_due_date: null,
  }))
}

// Builder whose result depends on the table and the created_by / user_id
// filter, so each user sees only their own contacts.
function digestSupabase(opts: {
  pages: Array<ReturnType<typeof makeUser>[]>
  contactsByUser: Record<string, ReturnType<typeof makeContacts>>
  creditUserIds?: string[]
  dailyUserIds?: string[]
  commitmentsByUser?: Record<string, unknown[]>
  digestHistoryByUser?: Record<string, unknown[]>
}) {
  const listUsers = vi.fn(async ({ page }: { page: number }) => ({
    data: { users: opts.pages[page - 1] ?? [] },
    error: null,
  }))
  const from = vi.fn((table: string) => {
    let ownerId: string | null = null
    const builder: Record<string, unknown> = {}
    for (const m of ["select", "insert", "in", "is", "gt", "gte", "lte", "order", "limit"]) {
      builder[m] = vi.fn(() => builder)
    }
    builder.eq = vi.fn((col: string, value: string) => {
      if (col === "created_by" || col === "user_id") ownerId = value
      return builder
    })
    const resolveData = () => {
      if (table === "contacts") return opts.contactsByUser[ownerId ?? ""] ?? []
      if (table === "pro_credits") return (opts.creditUserIds ?? []).map((user_id) => ({ user_id }))
      if (table === "commitments") return opts.commitmentsByUser?.[ownerId ?? ""] ?? []
      if (table === "digest_history") return opts.digestHistoryByUser?.[ownerId ?? ""] ?? []
      return []
    }
    builder.single = vi.fn(async () => ({
      data: table === "user_preferences" && opts.dailyUserIds?.includes(ownerId ?? "")
        ? { digest_frequency: "daily" }
        : null,
      error: null,
    }))
    builder.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: resolveData(), error: null }).then(resolve)
    return builder
  })
  const updateUserById = vi.fn<(...args: unknown[]) => Promise<{ data: object; error: null }>>(async () => ({ data: {}, error: null }))
  return { from, auth: { admin: { listUsers, updateUserById } } }
}

describe("GET /api/cron/daily-digest", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret"
    h.sendDigestEmail.mockClear()
    h.sendNewUserNudgeEmail.mockClear()
    h.sendActivationEmail.mockReset()
    h.sendActivationEmail.mockResolvedValue(undefined)
    vi.useFakeTimers({ toFake: ["Date"] })
    // A Monday, so weekly-frequency users are due.
    vi.setSystemTime(new Date("2026-10-05T14:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env = { ...ORIGINAL_ENV }
  })

  it("rejects requests without the cron secret", async () => {
    h.supabase = digestSupabase({ pages: [], contactsByUser: {} })
    const res = await GET(buildRequest({ url: URL }))
    expect(res.status).toBe(401)
  })

  it("reaches users beyond the first page of 1,000", async () => {
    // Regression: the user list came from an unpaginated contacts select,
    // which PostgREST caps at 1,000 rows, so later users got no digest.
    const firstPage = Array.from({ length: 1000 }, (_, i) => makeUser(`u${i}`))
    const lateUser = makeUser("late-user")
    const client = digestSupabase({
      pages: [firstPage, [lateUser]],
      contactsByUser: { "late-user": makeContacts("late-user", 6) },
    })
    h.supabase = client

    const res = await GET(
      buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } })
    )
    expect(res.status).toBe(200)
    expect(client.auth.admin.listUsers).toHaveBeenCalledWith({ page: 2, perPage: 1000 })
    expect(h.sendDigestEmail).toHaveBeenCalledTimes(1)
    expect(h.sendDigestEmail).toHaveBeenCalledWith(
      "late-user@example.com",
      "late-user",
      expect.any(Array),
      expect.objectContaining({ totalContacts: 6 })
    )
    expect((await res.json()).sent).toBe(1)
  })

  it("keeps sending to other users when one user's digest throws", async () => {
    const client = digestSupabase({
      pages: [[makeUser("a"), makeUser("b")]],
      contactsByUser: { a: makeContacts("a", 5), b: makeContacts("b", 5) },
    })
    h.supabase = client
    h.sendDigestEmail.mockImplementationOnce(async () => {
      throw new Error("resend down")
    })

    const res = await GET(
      buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } })
    )
    expect(res.status).toBe(200)
    expect(h.sendDigestEmail).toHaveBeenCalledTimes(2)
    expect((await res.json()).sent).toBe(1)
  })

  it("sends mid-week daily digests to users with referral Pro credit", async () => {
    vi.setSystemTime(new Date("2026-10-07T14:00:00Z")) // Wednesday
    h.supabase = digestSupabase({
      pages: [[makeUser("credit"), makeUser("free")]],
      contactsByUser: { credit: makeContacts("credit", 5), free: makeContacts("free", 5) },
      creditUserIds: ["credit"],
      dailyUserIds: ["credit", "free"],
    })
    const res = await GET(
      buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } })
    )
    expect(res.status).toBe(200)
    expect(h.sendDigestEmail).toHaveBeenCalledTimes(1)
    expect(h.sendDigestEmail).toHaveBeenCalledWith("credit@example.com", "credit", expect.any(Array), expect.objectContaining({ isPro: true }))
  })

  it("sends a promise that's due even when every contact was recently suggested", async () => {
    // Every contact was suggested in the last 14 days, so there are no
    // relationship picks, but a promise due tomorrow should still send.
    const contacts = makeContacts("founder", 5)
    h.supabase = digestSupabase({
      pages: [[makeUser("founder")]],
      contactsByUser: { founder: contacts },
      digestHistoryByUser: {
        founder: contacts.map((c) => ({ contact_id: c.id, sent_at: "2026-10-01T14:00:00Z" })),
      },
      commitmentsByUser: {
        founder: [{ id: "k1", contact_id: "founder-c0", direction: "user_owes", title: "Send the deck", due_at: "2026-10-06T17:00:00Z" }],
      },
    })
    const res = await GET(buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } }))
    expect(res.status).toBe(200)
    expect(h.sendDigestEmail).toHaveBeenCalledTimes(1)
    const [, , picks, stats] = h.sendDigestEmail.mock.calls[0] as unknown as [string, string, unknown[], { moves: { promises: Array<{ title: string; contactName: string }> } }]
    expect(picks).toEqual([])
    expect(stats.moves.promises).toEqual([expect.objectContaining({ title: "Send the deck", contactName: "Contact 0" })])
  })

  it("sends nothing when there are no picks and no moves", async () => {
    const contacts = makeContacts("quiet", 5)
    h.supabase = digestSupabase({
      pages: [[makeUser("quiet")]],
      contactsByUser: { quiet: contacts },
      digestHistoryByUser: { quiet: contacts.map((c) => ({ contact_id: c.id, sent_at: "2026-10-01T14:00:00Z" })) },
    })
    await GET(buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } }))
    expect(h.sendDigestEmail).not.toHaveBeenCalled()
  })

  it("sends the first activation email to a confirmed day-1 account with no contacts and records it", async () => {
    const newcomer = {
      ...makeUser("newcomer"),
      created_at: "2026-10-04T10:00:00Z",
      email_confirmed_at: "2026-10-04T10:05:00Z",
      app_metadata: { provider: "email", providers: ["email"] },
    }
    const client = digestSupabase({ pages: [[newcomer]], contactsByUser: {} })
    h.supabase = client
    const res = await GET(buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } }))
    expect((await res.json()).nudges).toBe(1)
    expect(h.sendActivationEmail).toHaveBeenCalledWith("newcomer@example.com", "newcomer", 1)
    expect(client.auth.admin.updateUserById).toHaveBeenCalledWith("newcomer", {
      app_metadata: expect.objectContaining({
        provider: "email",
        providers: ["email"],
        activation_emails_sent: 1,
        activation_email_last_at: expect.any(String),
      }),
    })
  })

  it("does not record an activation email that failed to send", async () => {
    const newcomer = {
      ...makeUser("newcomer"),
      created_at: "2026-10-04T10:00:00Z",
      email_confirmed_at: "2026-10-04T10:05:00Z",
      app_metadata: {},
    }
    const client = digestSupabase({ pages: [[newcomer]], contactsByUser: {} })
    h.supabase = client
    h.sendActivationEmail.mockRejectedValueOnce(new Error("resend down"))
    const res = await GET(buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } }))
    expect(res.status).toBe(200)
    expect(client.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  it("never sends activation email to unconfirmed or long-dormant accounts", async () => {
    const unconfirmed = { ...makeUser("pending"), created_at: "2026-10-04T10:00:00Z", app_metadata: {} }
    const dormant = { ...makeUser("dormant"), email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {} }
    h.supabase = digestSupabase({ pages: [[unconfirmed, dormant]], contactsByUser: {} })
    await GET(buildRequest({ url: URL, headers: { authorization: "Bearer test-cron-secret" } }))
    expect(h.sendActivationEmail).not.toHaveBeenCalled()
  })
})
