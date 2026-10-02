import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"

type Row = Record<string, unknown>

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  authUser: { id: "founder", email: "neil@savvo.app" } as { id: string; email: string } | null,
  users: {} as Record<string, { id: string; email: string; user_metadata?: Record<string, unknown> }>,
  plans: {} as Record<string, string>,
  sendEmail: vi.fn(async (..._args: unknown[]) => {}),
  failEmailTo: null as string | null,
}))

// In-memory table with the filters these routes use.
function table(name: string) {
  const filters: Array<(r: Row) => boolean> = []
  let op: "select" | "insert" | "update" | "delete" = "select"
  let payload: Row | null = null
  let returning = false
  let range: [number, number] | null = null
  let columns: string[] | null = null
  const project = (list: Row[]) => columns ? list.map((r) => Object.fromEntries(columns!.map((c) => [c, r[c]]))) : list
  const rows = () => (h.tables[name] ||= [])
  const run = () => {
    if (op === "insert") {
      const row: Row = { id: `00000000-0000-4000-8000-${String(rows().length + 1).padStart(12, "0")}`, created_at: new Date().toISOString(), last_sent_at: null, unsubscribed_at: null, ...payload }
      if (rows().some((r) => r.user_id === row.user_id && r.email === row.email)) return { data: null, error: { code: "23505", message: "duplicate" } }
      rows().push(row)
      return { data: project([row]), error: null }
    }
    const matched = rows().filter((r) => filters.every((f) => f(r)))
    if (op === "update") matched.forEach((r) => Object.assign(r, payload))
    if (op === "delete") h.tables[name] = rows().filter((r) => !matched.includes(r))
    const data = range ? matched.slice(range[0], range[1] + 1) : matched
    return { data: op === "select" || returning ? project(data) : null, error: null }
  }
  const b: Record<string, unknown> = {}
  b.select = vi.fn((cols?: string) => {
    if (op !== "select") returning = true
    if (cols && cols !== "*") columns = cols.split(",").map((c) => c.trim())
    return b
  })
  b.insert = vi.fn((p: Row) => { op = "insert"; payload = p; return b })
  b.update = vi.fn((p: Row) => { op = "update"; payload = p; return b })
  b.delete = vi.fn(() => { op = "delete"; return b })
  b.eq = vi.fn((col: string, v: unknown) => { filters.push((r) => r[col] === v); return b })
  b.is = vi.fn((col: string, v: unknown) => { filters.push((r) => (r[col] ?? null) === v); return b })
  b.not = vi.fn((col: string) => { filters.push((r) => r[col] != null); return b })
  b.gte = vi.fn((col: string, v: string) => { filters.push((r) => String(r[col]) >= v); return b })
  b.lte = vi.fn((col: string, v: string) => { filters.push((r) => String(r[col]) <= v); return b })
  b.order = vi.fn(() => b)
  b.range = vi.fn((from: number, to: number) => { range = [from, to]; return b })
  b.single = vi.fn(async () => { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error } })
  b.maybeSingle = b.single
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject)
  return b
}
const db = () => ({
  from: vi.fn((name: string) => table(name)),
  auth: {
    getUser: vi.fn(async () => ({ data: { user: h.authUser } })),
    admin: { getUserById: vi.fn(async (id: string) => ({ data: { user: h.users[id] ?? null } })) },
  },
})

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => db()), createServiceClient: vi.fn(async () => db()) }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock("@/lib/subscription", () => ({ getUserPlan: vi.fn(async (id: string) => h.plans[id] ?? "pro") }))
vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>()
  return {
    ...actual,
    sendEmail: vi.fn(async (payload: { to: string }) => {
      if (payload.to === h.failEmailTo) throw new Error("Resend send failed")
      return h.sendEmail(payload)
    }),
  }
})

import { GET as listRecipients, POST as addRecipient, DELETE as removeRecipient } from "@/app/api/settings/pipeline-digest/route"
import { POST as unsubscribe } from "@/app/api/pipeline-digest/unsubscribe/route"
import { GET as runCron } from "@/app/api/cron/pipeline-digest/route"

const SETTINGS = "http://localhost/api/settings/pipeline-digest"
const add = (email: unknown) => addRecipient(buildRequest({ url: SETTINGS, method: "POST", body: { email } }))
const TOKEN = "t".repeat(43)
const cron = () => runCron(buildRequest({ url: "http://localhost/api/cron/pipeline-digest", headers: { authorization: "Bearer test-cron-secret" } }))
const env = { ...process.env }
const recipient = (o: Row) => ({ id: `r-${o.email}`, user_id: "founder", unsubscribe_token: TOKEN, created_at: "2026-09-01", last_sent_at: null, unsubscribed_at: null, ...o })

beforeEach(() => {
  h.tables = {}
  h.authUser = { id: "founder", email: "neil@savvo.app" }
  h.users = { founder: { id: "founder", email: "neil@savvo.app", user_metadata: { full_name: "Neil Bajaj" } } }
  h.plans = {}
  h.sendEmail.mockClear()
  h.failEmailTo = null
  process.env.CRON_SECRET = "test-cron-secret"
  process.env.NEXT_PUBLIC_APP_URL = "https://savvo.app"
})
afterEach(() => {
  process.env = { ...env }
})

describe("settings: who gets the weekly pipeline email", () => {
  it("adds a co-founder, normalising the address, with a private unsubscribe token", async () => {
    const res = await add("  CoFounder@Startup.com ")
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.recipient.email).toBe("cofounder@startup.com")
    expect(body.recipient).not.toHaveProperty("unsubscribe_token")
    expect(h.tables.pipeline_digest_recipients[0].unsubscribe_token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const list = await (await listRecipients()).json()
    expect(list).toMatchObject({ can_use: true, max: 3, recipients: [{ email: "cofounder@startup.com" }] })
    expect(list.recipients[0]).not.toHaveProperty("unsubscribe_token")
  })

  it("is a Pro feature", async () => {
    h.plans.founder = "free"
    expect((await add("a@b.com")).status).toBe(403)
    expect((await (await listRecipients()).json()).can_use).toBe(false)
  })

  it("rejects bad addresses, duplicates, and a fourth person", async () => {
    expect((await add("not an email")).status).toBe(400)
    expect((await add(undefined)).status).toBe(400)
    await add("a@b.com")
    expect((await add("A@B.com")).status).toBe(409)
    await add("c@d.com")
    await add("e@f.com")
    const fourth = await add("g@h.com")
    expect(fourth.status).toBe(400)
    expect((await fourth.json()).error).toContain("up to 3")
  })

  it("can't re-add someone who unsubscribed", async () => {
    h.tables.pipeline_digest_recipients = [recipient({ email: "gone@x.com", unsubscribed_at: "2026-09-10" })]
    const res = await add("gone@x.com")
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("stopped these emails")
  })

  it("removes only the founder's own, still-subscribed recipients", async () => {
    h.tables.pipeline_digest_recipients = [
      recipient({ id: "11111111-1111-4111-8111-111111111111", email: "mine@x.com" }),
      recipient({ id: "22222222-2222-4222-8222-222222222222", email: "theirs@x.com", user_id: "someone-else" }),
      recipient({ id: "33333333-3333-4333-8333-333333333333", email: "gone@x.com", unsubscribed_at: "2026-09-10" }),
    ]
    const del = (id: string) => removeRecipient(buildRequest({ url: `${SETTINGS}?id=${id}`, method: "DELETE" }))
    expect((await del("22222222-2222-4222-8222-222222222222")).status).toBe(404)
    expect((await del("33333333-3333-4333-8333-333333333333")).status).toBe(404)
    expect((await del("11111111-1111-4111-8111-111111111111")).status).toBe(200)
    expect(h.tables.pipeline_digest_recipients.map((r) => r.email)).toEqual(["theirs@x.com", "gone@x.com"])
    expect((await del("nope")).status).toBe(400)
  })

  it("requires sign-in", async () => {
    h.authUser = null
    expect((await add("a@b.com")).status).toBe(401)
  })
})

describe("recipient unsubscribe (no account needed)", () => {
  beforeEach(() => {
    h.tables.pipeline_digest_recipients = [recipient({ email: "cofounder@x.com" })]
  })

  it("one-click from the mail client (RFC 8058) stops the email", async () => {
    const res = await unsubscribe(new Request(`https://savvo.app/api/pipeline-digest/unsubscribe?token=${TOKEN}`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click",
    }))
    expect(res.status).toBe(200)
    expect(h.tables.pipeline_digest_recipients[0].unsubscribed_at).toEqual(expect.any(String))
  })

  it("the confirm form redirects back to the page showing it's done", async () => {
    const res = await unsubscribe(new Request("https://savvo.app/api/pipeline-digest/unsubscribe", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `token=${TOKEN}`,
    }))
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe(`https://savvo.app/pipeline/unsubscribe/${TOKEN}?done=1`)
    expect(h.tables.pipeline_digest_recipients[0].unsubscribed_at).toEqual(expect.any(String))
  })

  it("rejects a malformed token", async () => {
    const res = await unsubscribe(new Request("https://savvo.app/api/pipeline-digest/unsubscribe?token=bad", { method: "POST" }))
    expect(res.status).toBe(400)
    expect(h.tables.pipeline_digest_recipients[0].unsubscribed_at).toBeNull()
  })
})

describe("Monday cron", () => {
  const investors = () => [
    { id: "i1", created_by: "founder", name: "Maya Chen", company: "Northwind", investor_stage: "diligence", archived_at: null },
    { id: "i2", created_by: "founder", name: "Sam Ortiz", company: "Index", investor_stage: "first_meeting", archived_at: null },
    { id: "i3", created_by: "founder", name: "Archived Al", company: null, investor_stage: "committed", archived_at: "2026-09-01" },
  ]

  it("rejects calls without the cron secret", async () => {
    expect((await runCron(buildRequest({ url: "http://localhost/api/cron/pipeline-digest" }))).status).toBe(401)
  })

  it("emails each recipient their own copy, with one-click unsubscribe and replies to the founder", async () => {
    h.tables.contacts = investors()
    h.tables.contact_activities = [{ id: "a1", user_id: "founder", contact_id: "i2", type: "meeting", occurred_at: new Date(Date.now() - 86_400_000).toISOString() }]
    h.tables.pipeline_digest_recipients = [
      recipient({ email: "cofounder@x.com", unsubscribe_token: "a".repeat(43) }),
      recipient({ email: "advisor@x.com", unsubscribe_token: "b".repeat(43) }),
      recipient({ email: "gone@x.com", unsubscribe_token: "c".repeat(43), unsubscribed_at: "2026-09-01" }),
    ]
    const body = await (await cron()).json()
    expect(body).toMatchObject({ sent: 2, failed: 0 })
    expect(h.sendEmail).toHaveBeenCalledTimes(2)
    const first = h.sendEmail.mock.calls[0][0] as { to: string; replyTo: string; subject: string; html: string; headers: Record<string, string> }
    expect(first.to).toBe("cofounder@x.com")
    expect(first.replyTo).toBe("neil@savvo.app")
    expect(first.subject).toBe("Neil Bajaj's raise this week: 2 active")
    expect(first.headers["List-Unsubscribe"]).toBe(`<https://savvo.app/api/pipeline-digest/unsubscribe?token=${"a".repeat(43)}>`)
    expect(first.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
    expect(first.html).toContain(`https://savvo.app/pipeline/unsubscribe/${"a".repeat(43)}`)
    expect(first.html).toContain("Sam Ortiz")
    expect(first.html).not.toContain("Archived Al")
    expect(first.html).not.toContain("Email preferences")
    expect(h.tables.pipeline_digest_recipients.filter((r) => r.last_sent_at).length).toBe(2)
  })

  it("never emails twice in a week, even if the cron runs again", async () => {
    h.tables.contacts = investors()
    h.tables.pipeline_digest_recipients = [recipient({ email: "cofounder@x.com" })]
    await cron()
    await cron()
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
  })

  it("skips founders on the free plan and founders with no investors yet", async () => {
    h.users.free = { id: "free", email: "f@x.com" }
    h.plans.free = "free"
    h.tables.contacts = []
    h.tables.pipeline_digest_recipients = [
      recipient({ email: "cofounder@x.com" }),
      recipient({ email: "other@x.com", user_id: "free" }),
    ]
    const body = await (await cron()).json()
    expect(body).toMatchObject({ sent: 0, skipped: 2 })
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it("one failed send doesn't stop the rest, and is retried next run", async () => {
    h.tables.contacts = investors()
    h.tables.pipeline_digest_recipients = [recipient({ email: "bounce@x.com" }), recipient({ email: "ok@x.com" })]
    h.failEmailTo = "bounce@x.com"
    const body = await (await cron()).json()
    expect(body).toMatchObject({ sent: 1, failed: 1 })
    expect(h.tables.pipeline_digest_recipients.find((r) => r.email === "bounce@x.com")?.last_sent_at).toBeNull()
  })
})
