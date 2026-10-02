import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Supabase mock with per-table queued results ───
// Each from(table) call takes the next queued result for that table (or the
// last one, repeatedly). Every chained call is recorded for assertions.

type Result = { data: unknown; error: null | { message: string; code?: string } }

function makeClient(opts: {
  user?: { id: string; email?: string } | null
  tables?: Record<string, Result[]>
  rpc?: Record<string, Result>
  adminUser?: { email: string } | null
}) {
  const queues = Object.fromEntries(Object.entries(opts.tables || {}).map(([k, v]) => [k, [...v]]))
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const from = vi.fn((table: string) => {
    const queue = queues[table] || [{ data: null, error: null }]
    const result = queue.length > 1 ? queue.shift()! : queue[0]
    const builder: Record<string, unknown> = {}
    for (const method of ["select", "insert", "update", "delete", "eq", "is", "not", "in", "order", "limit", "range"]) {
      builder[method] = vi.fn((...args: unknown[]) => {
        calls.push({ table, method, args })
        return builder
      })
    }
    builder.single = vi.fn(async () => result)
    builder.maybeSingle = vi.fn(async () => result)
    builder.then = (resolve: (v: Result) => void) => Promise.resolve(result).then(resolve)
    return builder
  })
  return {
    from,
    calls,
    rpc: vi.fn(async (name: string) => opts.rpc?.[name] ?? { data: null, error: null }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.user ?? null } })),
      exchangeCodeForSession: vi.fn(),
      updateUser: vi.fn(async () => ({ error: null })),
      admin: {
        getUserById: vi.fn(async () => ({ data: { user: opts.adminUser ?? null }, error: null })),
      },
    },
  }
}

const h = vi.hoisted(() => ({
  user: null as ReturnType<typeof makeClient> | null,
  service: null as ReturnType<typeof makeClient> | null,
  rateLimitOk: true,
  plan: "pro" as "free" | "pro",
  sendIntroResponseEmail: vi.fn(async () => undefined),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.user),
  createServiceClient: vi.fn(async () => h.service),
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: h.rateLimitOk, limit: 10, remaining: 9, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }))
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendIntroResponseEmail: h.sendIntroResponseEmail,
}))
vi.mock("@vercel/analytics/server", () => ({ track: vi.fn() }))
vi.mock("@/lib/subscription", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subscription")>()),
  getUserPlan: vi.fn(async () => h.plan),
}))

import { GET as referralLanding } from "@/app/r/[code]/route"
import { GET as authCallback } from "@/app/auth/callback/route"
import { GET as getReferrals } from "@/app/api/referrals/route"
import { GET as getSnapshot, POST as saveSnapshot, DELETE as deleteSnapshot } from "@/app/api/raise-snapshot/route"
import { POST as shareIntro, DELETE as unshareIntro } from "@/app/api/intro-requests/[id]/share/route"
import { POST as respondIntro } from "@/app/api/intro/[token]/route"
import { getPlanDetails } from "@/lib/subscription"
import { PUT as updateContact } from "@/app/api/contacts/[id]/route"

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "founder@example.com" }
const REQUEST_ID = "33333333-3333-4333-8333-333333333333"
const TOKEN = "A".repeat(43)
const params = <T,>(value: T) => ({ params: Promise.resolve(value) })
const json = (body: unknown, headers: Record<string, string> = {}) =>
  ({ method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) })

beforeEach(() => {
  h.rateLimitOk = true
  h.plan = "pro"
  h.sendIntroResponseEmail.mockClear()
  h.revalidatePath.mockClear()
  process.env.NEXT_PUBLIC_APP_URL = "https://savvo.app"
  process.env.RESEND_API_KEY = "re_test"
})

// ─── Referrals ───

describe("referral landing /r/[code]", () => {
  it("remembers a valid code and lands on the homepage tagged as referral traffic", async () => {
    const res = await referralLanding(new Request("https://savvo.app/r/ABCD2345"), params({ code: "ABCD2345" }))
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get("location")!)
    expect(location.pathname).toBe("/")
    expect(location.searchParams.get("utm_source")).toBe("referral")
    expect(res.headers.get("set-cookie")).toContain("savvo_ref=abcd2345")
  })

  it("ignores malformed codes but still redirects", async () => {
    const res = await referralLanding(new Request("https://savvo.app/r/x;y"), params({ code: "x;y" }))
    expect(res.status).toBe(307)
    expect(res.headers.get("set-cookie")).toBeNull()
  })
})

describe("referral claim in /auth/callback", () => {
  function callback(cookie: string) {
    return new Request("https://savvo.app/auth/callback?code=abc", { headers: { cookie } })
  }

  it("claims the cookie's code for the signed-in user and clears the cookie", async () => {
    h.user = makeClient({})
    h.user.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: USER.id, created_at: "2020-01-01T00:00:00Z", user_metadata: {}, app_metadata: { provider: "google" } } },
    })
    h.service = makeClient({ rpc: { claim_referral: { data: "claimed", error: null } } })

    const res = await authCallback(callback("savvo_ref=abcd2345"))
    expect(h.service.rpc).toHaveBeenCalledWith("claim_referral", { p_code: "abcd2345", p_referred_user_id: USER.id })
    expect(res.headers.get("set-cookie")).toMatch(/savvo_ref=;/)
  })

  it("falls back to the code saved in signup metadata (email confirmed on another device)", async () => {
    h.user = makeClient({})
    h.user.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: USER.id, created_at: "2020-01-01T00:00:00Z", user_metadata: { referral_code: "wxyz6789" }, app_metadata: { provider: "email" } } },
    })
    h.service = makeClient({ rpc: { claim_referral: { data: "claimed", error: null } } })

    await authCallback(callback(""))
    expect(h.service.rpc).toHaveBeenCalledWith("claim_referral", { p_code: "wxyz6789", p_referred_user_id: USER.id })
  })

  it("ignores a malformed referral cookie instead of failing sign-in", async () => {
    h.user = makeClient({})
    h.user.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: USER.id, created_at: "2020-01-01T00:00:00Z", user_metadata: {}, app_metadata: { provider: "google" } } },
    })
    h.service = makeClient({})
    const res = await authCallback(callback("savvo_ref=%E0%A4%A"))
    expect(res.headers.get("location")).toBe("https://savvo.app/dashboard")
    expect(h.service.rpc).not.toHaveBeenCalled()
  })

  it("never blocks sign-in when the claim fails", async () => {
    h.user = makeClient({})
    h.user.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: USER.id, created_at: "2020-01-01T00:00:00Z", user_metadata: {}, app_metadata: { provider: "google" } } },
    })
    h.service = makeClient({})
    h.service.rpc.mockRejectedValue(new Error("db down"))

    const res = await authCallback(callback("savvo_ref=abcd2345"))
    expect(res.headers.get("location")).toBe("https://savvo.app/dashboard")
  })
})

describe("GET /api/referrals", () => {
  it("returns the link, counts, and active Pro credit", async () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString()
    h.user = makeClient({
      user: USER,
      tables: { referrals: [{ data: [{ status: "rewarded" }, { status: "signed_up" }], error: null }] },
    })
    h.service = makeClient({
      tables: {
        referral_codes: [{ data: { code: "abcd2345" }, error: null }],
        pro_credits: [{ data: { pro_until: future }, error: null }],
      },
    })
    const res = await getReferrals()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      url: "https://savvo.app/r/abcd2345",
      signedUp: 2,
      rewarded: 1,
      rewardDays: 30,
      proCreditUntil: future,
    })
  })

  it("rejects anonymous requests", async () => {
    h.user = makeClient({ user: null })
    expect((await getReferrals()).status).toBe(401)
  })
})

describe("plan resolution with referral credit", () => {
  it("treats active credit as Pro when there is no paid subscription", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    h.service = makeClient({
      tables: {
        subscriptions: [{ data: null, error: null }],
        pro_credits: [{ data: { pro_until: future }, error: null }],
      },
    })
    const details = await getPlanDetails(USER.id)
    expect(details.plan).toBe("pro")
    expect(details.source).toBe("credit")
  })

  it("ignores expired credit", async () => {
    h.service = makeClient({
      tables: {
        subscriptions: [{ data: null, error: null }],
        pro_credits: [{ data: { pro_until: "2020-01-01T00:00:00Z" }, error: null }],
      },
    })
    expect(await getPlanDetails(USER.id)).toEqual({ plan: "free", source: null, proCreditUntil: null, hasBillingAccount: false })
  })

  it("flags a past_due Stripe subscription so credit users can still reach billing", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    h.service = makeClient({
      tables: {
        subscriptions: [{ data: { plan: "pro", status: "past_due", stripe_subscription_id: "sub_1", current_period_end: null }, error: null }],
        pro_credits: [{ data: { pro_until: future }, error: null }],
      },
    })
    expect(await getPlanDetails(USER.id)).toMatchObject({ plan: "pro", source: "credit", hasBillingAccount: true })
  })

  it("prefers the paid subscription as the source", async () => {
    h.service = makeClient({
      tables: {
        subscriptions: [{ data: { plan: "pro", status: "active", current_period_end: null }, error: null }],
        pro_credits: [{ data: null, error: null }],
      },
    })
    expect((await getPlanDetails(USER.id)).source).toBe("subscription")
  })
})

// ─── Raise stage + snapshot ───

describe("contact raise stage", () => {
  const CONTACT = "44444444-4444-4444-8444-444444444444"

  it("accepts a valid stage and rejects unknown ones", async () => {
    h.user = makeClient({
      user: USER,
      tables: { contacts: [{ data: { id: CONTACT, investor_stage: "diligence", created_at: "2026-01-01" }, error: null }] },
    })
    const ok = await updateContact(new Request("https://savvo.app", { ...json({ investor_stage: "diligence" }), method: "PUT" }), params({ id: CONTACT }))
    expect(ok.status).toBe(200)
    expect(h.user.calls).toContainEqual({ table: "contacts", method: "update", args: [{ investor_stage: "diligence" }] })
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard")

    const bad = await updateContact(new Request("https://savvo.app", { ...json({ investor_stage: "series_z" }), method: "PUT" }), params({ id: CONTACT }))
    expect(bad.status).toBe(400)
  })
})

describe("/api/raise-snapshot", () => {
  it("previews stage counts for the owner before any link exists", async () => {
    h.user = makeClient({
      user: USER,
      tables: {
        raise_snapshots: [{ data: null, error: null }],
        contacts: [{ data: [{ investor_stage: "first_meeting" }, { investor_stage: "first_meeting" }, { investor_stage: "passed" }], error: null }],
      },
    })
    const res = await getSnapshot()
    expect(await res.json()).toEqual({ snapshot: null, stages: { first_meeting: 2, passed: 1 } })
  })

  it("creates a link with an unguessable token", async () => {
    h.user = makeClient({
      user: USER,
      tables: {
        raise_snapshots: [
          { data: null, error: null },
          { data: { token: TOKEN, title: "Acme seed" }, error: null },
        ],
      },
    })
    const res = await saveSnapshot(new Request("https://savvo.app", json({ title: " Acme seed " })))
    expect(res.status).toBe(200)
    expect((await res.json()).snapshot.url).toBe(`https://savvo.app/s/${TOKEN}`)
    const insert = h.user.calls.find((c) => c.method === "insert")!
    expect(insert.args[0]).toMatchObject({ user_id: USER.id, title: "Acme seed" })
    expect((insert.args[0] as { token: string }).token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it("keeps the existing token when the title changes", async () => {
    h.user = makeClient({
      user: USER,
      tables: {
        raise_snapshots: [
          { data: { token: TOKEN }, error: null },
          { data: { token: TOKEN, title: null }, error: null },
        ],
      },
    })
    await saveSnapshot(new Request("https://savvo.app", json({ title: "" })))
    expect(h.user.calls.some((c) => c.method === "insert")).toBe(false)
    expect(h.user.calls).toContainEqual({ table: "raise_snapshots", method: "update", args: [{ title: null }] })
  })

  it("rejects overlong titles and revokes on DELETE", async () => {
    h.user = makeClient({ user: USER, tables: { raise_snapshots: [{ data: null, error: null }] } })
    expect((await saveSnapshot(new Request("https://savvo.app", json({ title: "x".repeat(81) })))).status).toBe(400)
    const res = await deleteSnapshot()
    expect(await res.json()).toEqual({ snapshot: null })
    expect(h.user.calls).toContainEqual({ table: "raise_snapshots", method: "delete", args: [] })
  })
})

// ─── Hosted intro links ───

describe("POST /api/intro-requests/[id]/share", () => {
  it("issues a link and marks a draft as asked", async () => {
    h.user = makeClient({
      user: USER,
      tables: {
        intro_requests: [
          { data: { id: REQUEST_ID, status: "draft", share_token: null, connector_contact_id: "c1" }, error: null },
          { data: { id: REQUEST_ID, status: "requested", share_token: TOKEN }, error: null },
        ],
      },
    })
    const res = await shareIntro(new Request("https://savvo.app", { method: "POST" }), params({ id: REQUEST_ID }))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe(`https://savvo.app/i/${TOKEN}`)
    const update = h.user.calls.find((c) => c.method === "update")!
    expect(update.args[0]).toMatchObject({ status: "requested" })
    expect(h.user.calls).toContainEqual({ table: "intro_requests", method: "is", args: ["share_token", null] })
  })

  it("returns the existing link instead of rotating it", async () => {
    h.user = makeClient({
      user: USER,
      tables: { intro_requests: [{ data: { id: REQUEST_ID, status: "requested", share_token: TOKEN, connector_contact_id: "c1" }, error: null }] },
    })
    const res = await shareIntro(new Request("https://savvo.app", { method: "POST" }), params({ id: REQUEST_ID }))
    expect((await res.json()).url).toBe(`https://savvo.app/i/${TOKEN}`)
    expect(h.user.calls.some((c) => c.method === "update")).toBe(false)
  })

  it("is Pro-gated like creating an intro request", async () => {
    h.plan = "free"
    h.user = makeClient({ user: USER })
    expect((await shareIntro(new Request("https://savvo.app", { method: "POST" }), params({ id: REQUEST_ID }))).status).toBe(403)
  })

  it("turns a link off by clearing its token", async () => {
    h.user = makeClient({
      user: USER,
      tables: { intro_requests: [{ data: { id: REQUEST_ID, share_token: null }, error: null }] },
    })
    const res = await unshareIntro(new Request("https://savvo.app", { method: "DELETE" }), params({ id: REQUEST_ID }))
    expect(res.status).toBe(200)
    expect(h.user.calls).toContainEqual({ table: "intro_requests", method: "update", args: [{ share_token: null }] })
  })

  it("needs a connector and an owned request", async () => {
    h.user = makeClient({
      user: USER,
      tables: { intro_requests: [{ data: { id: REQUEST_ID, status: "draft", share_token: null, connector_contact_id: null }, error: null }] },
    })
    expect((await shareIntro(new Request("https://savvo.app", { method: "POST" }), params({ id: REQUEST_ID }))).status).toBe(400)

    h.user = makeClient({ user: USER, tables: { intro_requests: [{ data: null, error: null }] } })
    expect((await shareIntro(new Request("https://savvo.app", { method: "POST" }), params({ id: REQUEST_ID }))).status).toBe(404)
  })
})

describe("POST /api/intro/[token] (public)", () => {
  const summary = { data: { connector_name: "Sam Lee", target_name: "Jane Partner" }, error: null }

  it("records an acceptance and emails the founder", async () => {
    h.service = makeClient({
      rpc: {
        intro_request_for_token: summary,
        respond_to_intro_request: { data: { outcome: "accepted", user_id: USER.id, request_id: REQUEST_ID }, error: null },
      },
      adminUser: { email: USER.email },
    })
    const res = await respondIntro(
      new Request("https://savvo.app", json({ accept: true, note: " Happy to <b>help</b> " }, { "x-forwarded-for": "1.2.3.4, 10.0.0.1" })),
      params({ token: TOKEN })
    )
    expect(res.status).toBe(200)
    expect(h.service.rpc).toHaveBeenCalledWith("respond_to_intro_request", { p_token: TOKEN, p_accept: true, p_note: " Happy to <b>help</b> " })
    expect(h.sendIntroResponseEmail).toHaveBeenCalledWith(USER.email, {
      accepted: true,
      connectorName: "Sam Lee",
      targetName: "Jane Partner",
      note: "Happy to <b>help</b>",
    })
    expect(h.revalidatePath).toHaveBeenCalledWith("/intros")
  })

  it("returns 409 for a second answer and does not email again", async () => {
    h.service = makeClient({
      rpc: {
        intro_request_for_token: summary,
        respond_to_intro_request: { data: { outcome: "already_responded", status: "accepted" }, error: null },
      },
    })
    const res = await respondIntro(new Request("https://savvo.app", json({ accept: false })), params({ token: TOKEN }))
    expect(res.status).toBe(409)
    expect(h.sendIntroResponseEmail).not.toHaveBeenCalled()
  })

  it("keeps the answer when the notification email fails", async () => {
    h.service = makeClient({
      rpc: {
        intro_request_for_token: summary,
        respond_to_intro_request: { data: { outcome: "declined", user_id: USER.id }, error: null },
      },
      adminUser: { email: USER.email },
    })
    h.sendIntroResponseEmail.mockRejectedValueOnce(new Error("resend down"))
    const res = await respondIntro(new Request("https://savvo.app", json({ accept: false })), params({ token: TOKEN }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ outcome: "declined" })
  })

  it("rejects bad tokens, bad bodies, unknown links, and floods", async () => {
    h.service = makeClient({})
    expect((await respondIntro(new Request("https://savvo.app", json({ accept: true })), params({ token: "nope" }))).status).toBe(404)
    expect((await respondIntro(new Request("https://savvo.app", json({ accept: "yes" })), params({ token: TOKEN }))).status).toBe(400)
    expect((await respondIntro(new Request("https://savvo.app", json({ accept: true })), params({ token: TOKEN }))).status).toBe(404)
    expect(h.service.rpc).not.toHaveBeenCalledWith("respond_to_intro_request", expect.anything())
    h.rateLimitOk = false
    expect((await respondIntro(new Request("https://savvo.app", json({ accept: true })), params({ token: TOKEN }))).status).toBe(429)
  })
})
