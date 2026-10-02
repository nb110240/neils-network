import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"

type Result = { data: unknown; error: null | { message: string; code?: string } }

const h = vi.hoisted(() => ({
  client: null as ReturnType<typeof perTableSupabase> | null,
  event: null as unknown,
  received: null as unknown,
  verifyThrows: false,
  plan: "pro" as "free" | "pro" | "team",
  analysis: vi.fn(),
  receivingGet: vi.fn(),
  inserts: [] as unknown[],
  sendPush: vi.fn(async () => ({ sent: 1, removed: 0 })),
}))

vi.mock("resend", () => ({
  Resend: class {
    webhooks = {
      verify: vi.fn(() => {
        if (h.verifyThrows) throw new Error("bad signature")
        return h.event
      }),
    }
    emails = { receiving: { get: h.receivingGet } }
  },
}))
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => h.client),
  createClient: vi.fn(async () => h.client),
}))
vi.mock("@/lib/subscription", () => ({ getUserPlan: vi.fn(async () => h.plan) }))
vi.mock("@/lib/action-extraction", () => ({ analyzeInteraction: h.analysis }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/push/send", () => ({ sendPushToUser: h.sendPush }))
// after() needs a Next.js request scope; run the callback inline instead.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")
  return { ...actual, after: (fn: () => unknown) => { void fn() } }
})

import { POST } from "@/app/api/webhooks/resend/route"

const TOKEN = "a".repeat(48)
const webhookEvent = {
  type: "email.received",
  created_at: "2026-07-17T18:00:00.000Z",
  data: {
    email_id: "email-1",
    created_at: "2026-07-17T18:00:00.000Z",
    from: "Neil <neil@savvo.app>",
    to: [`notes-${TOKEN}@inbound.savvo.app`],
    bcc: [],
    cc: [],
    message_id: "message-1",
    subject: "Fwd: Investor meeting",
    attachments: [],
  },
}

function perTableSupabase(results: Record<string, Result[]>) {
  const queued = Object.fromEntries(Object.entries(results).map(([key, value]) => [key, [...value]]))
  return {
    from: vi.fn((table: string) => {
      const result = queued[table]?.shift() || { data: null, error: null }
      const builder: Record<string, unknown> = {}
      for (const method of ["select", "insert", "update", "upsert", "eq", "in", "limit"]) {
        builder[method] = vi.fn((value: unknown) => {
          if (method === "insert") h.inserts.push(value)
          return builder
        })
      }
      builder.single = vi.fn(async () => result)
      builder.maybeSingle = vi.fn(async () => result)
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve)
      return builder
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
      admin: {
        getUserById: vi.fn(async () => ({ data: { user: { id: "user-1", email: "neil@savvo.app" } }, error: null })),
      },
    },
  }
}

function request(headers: Record<string, string> = {}) {
  return buildRequest({
    method: "POST",
    url: "http://localhost/api/webhooks/resend",
    body: "{}",
    headers: {
      "svix-id": "msg_1",
      "svix-timestamp": "1752775200",
      "svix-signature": "v1,signature",
      ...headers,
    },
  })
}

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test"
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
    process.env.RESEND_RECEIVING_DOMAIN = "inbound.savvo.app"
    h.client = perTableSupabase({})
    h.event = webhookEvent
    h.verifyThrows = false
    h.plan = "pro"
    h.inserts = []
    h.analysis.mockReset()
    h.analysis.mockResolvedValue({
      summary: "Investor follow-up agreed.",
      contactPatch: { name: "Alex" },
      commitments: [],
      followUpDraft: "Thanks for the conversation.",
    })
    h.receivingGet.mockReset()
    h.receivingGet.mockResolvedValue({
      data: {
        id: "email-1",
        from: "Neil <neil@savvo.app>",
        to: webhookEvent.data.to,
        subject: webhookEvent.data.subject,
        created_at: webhookEvent.created_at,
        text: "Alex agreed to introduce us to the partner after the investor meeting.",
        html: null,
      },
      error: null,
    })
  })

  it("rejects a webhook whose signature cannot be verified", async () => {
    h.verifyThrows = true
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(h.receivingGet).not.toHaveBeenCalled()
  })

  it("ignores valid non-email events", async () => {
    h.event = { type: "email.delivered", data: {} }
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(h.receivingGet).not.toHaveBeenCalled()
  })

  it("rejects email from anyone except the account owner before paid analysis", async () => {
    h.event = { ...webhookEvent, data: { ...webhookEvent.data, from: "attacker@example.com" } }
    h.client = perTableSupabase({ inbound_aliases: [{ data: { user_id: "user-1" }, error: null }] })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(h.analysis).not.toHaveBeenCalled()
    expect(h.receivingGet).not.toHaveBeenCalled()
  })

  it("does not reprocess an already-ingested Resend email", async () => {
    h.client = perTableSupabase({
      inbound_aliases: [{ data: { user_id: "user-1" }, error: null }],
      after_call_reviews: [{ data: { id: "review-1" }, error: null }],
    })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect((await response.json()).deduplicated).toBe(true)
    expect(h.receivingGet).not.toHaveBeenCalled()
  })

  it("creates only a pending review for an authenticated forwarded note", async () => {
    h.client = perTableSupabase({
      inbound_aliases: [{ data: { user_id: "user-1" }, error: null }],
      after_call_reviews: [
        { data: null, error: null },
        { data: { id: "review-1" }, error: null },
      ],
    })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(h.analysis).toHaveBeenCalledOnce()
    expect(h.inserts).toEqual([expect.objectContaining({
      user_id: "user-1",
      source: "forwarded_email",
      external_source_id: "email-1",
      contact_id: null,
    })])
    expect(h.client!.from).not.toHaveBeenCalledWith("contacts")
    expect(h.client!.from).not.toHaveBeenCalledWith("commitments")
    // The phone hears about it, deep-linked to the new review.
    expect(h.sendPush).toHaveBeenCalledWith(h.client, "user-1", expect.objectContaining({
      title: "Forwarded notes ready",
      body: '"Fwd: Investor meeting" is ready to review',
      url: "/inbox?review=review-1",
    }))
  })
})
