import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  sendMock: vi.fn(async (_arg?: unknown) => ({ data: { id: "email-1" }, error: null })),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.supabase),
  createServiceClient: vi.fn(async () => h.supabase),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({
    success: h.rateLimitSuccess,
    limit: 100,
    remaining: 99,
    reset: Date.now() + 60_000,
  })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// No real email — mock the Resend SDK so .emails.send() never hits the network.
// Resend is instantiated with `new`, so the mock must be a constructable class.
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (arg: unknown) => h.sendMock(arg) }
  },
}))

import { POST } from "@/app/api/support/route"

const URL = "http://localhost/api/support"

describe("POST /api/support", () => {
  const originalKey = process.env.RESEND_API_KEY

  beforeEach(() => {
    h.rateLimitSuccess = true
    h.sendMock = vi.fn(async () => ({ data: { id: "email-1" }, error: null }))
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await POST(postRequest(URL, { subject: "Bug", message: "Something broke" }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "a@b.com" } })
    h.rateLimitSuccess = false
    const res = await POST(postRequest(URL, { subject: "Bug", message: "Something broke" }))
    expect(res.status).toBe(429)
  })

  it("rejects an empty subject with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "a@b.com" } })
    const res = await POST(postRequest(URL, { subject: "", message: "Something broke" }))
    expect(res.status).toBe(400)
  })

  it("rejects a too-short message with 400", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "a@b.com" } })
    const res = await POST(postRequest(URL, { subject: "Bug", message: "hi" }))
    expect(res.status).toBe(400)
  })

  it("sends a support email when RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "a@b.com" } })
    const res = await POST(
      postRequest(URL, { subject: "Bug report", message: "The merge button is broken" })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(h.sendMock).toHaveBeenCalledTimes(1)
  })

  it("succeeds without sending email when RESEND_API_KEY is absent", async () => {
    delete process.env.RESEND_API_KEY
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "a@b.com" } })
    const res = await POST(
      postRequest(URL, { subject: "Bug report", message: "The merge button is broken" })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(h.sendMock).not.toHaveBeenCalled()
  })

  it("returns 500 when sending the email throws", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    h.sendMock = vi.fn(async () => {
      throw new Error("resend network error")
    })
    h.supabase = createMockSupabase({ authUser: { id: "u1", email: "a@b.com" } })
    const res = await POST(
      postRequest(URL, { subject: "Bug report", message: "The merge button is broken" })
    )
    expect(res.status).toBe(500)
  })
})
