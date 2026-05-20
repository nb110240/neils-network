import { describe, it, expect, vi, beforeEach } from "vitest"
import { postRequest } from "../helpers/mock-request"

// ─── Route mocks ───
// The welcome route authenticates via a timing-safe internal secret header,
// not a Supabase session. It sends email through the `resend` package, which
// we mock so no real email is sent. The hoisted holder lets each test control
// whether the mocked Resend send succeeds.
const h = vi.hoisted(() => ({
  sendThrows: false,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => null),
  createServiceClient: vi.fn(async () => null),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: vi.fn(async () => {
        if (h.sendThrows) throw new Error("Resend API error")
        return { data: { id: "email_1" }, error: null }
      }),
    }
  },
}))

const SECRET = "test-internal-secret"

import { POST } from "@/app/api/auth/welcome/route"

describe("POST /api/auth/welcome", () => {
  beforeEach(() => {
    h.sendThrows = false
    process.env.INTERNAL_API_SECRET = SECRET
  })

  it("rejects requests with no internal secret header (403)", async () => {
    const res = await POST(postRequest("http://localhost/api/auth/welcome", { email: "a@test.com" }))
    expect(res.status).toBe(403)
  })

  it("rejects requests with a wrong internal secret (403)", async () => {
    const res = await POST(
      postRequest(
        "http://localhost/api/auth/welcome",
        { email: "a@test.com" },
        { "x-internal-secret": "wrong-secret-value" }
      )
    )
    expect(res.status).toBe(403)
  })

  it("returns 400 when the email is missing", async () => {
    const res = await POST(
      postRequest(
        "http://localhost/api/auth/welcome",
        { name: "Neil" },
        { "x-internal-secret": SECRET }
      )
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.message).toBe("Email is required")
  })

  it("sends a welcome email for a valid authorized request", async () => {
    const res = await POST(
      postRequest(
        "http://localhost/api/auth/welcome",
        { email: "neil@test.com", name: "Neil" },
        { "x-internal-secret": SECRET }
      )
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it("succeeds when no name is provided (defaults to 'there')", async () => {
    const res = await POST(
      postRequest(
        "http://localhost/api/auth/welcome",
        { email: "neil@test.com" },
        { "x-internal-secret": SECRET }
      )
    )
    expect(res.status).toBe(200)
  })

  it("returns 500 when the email provider throws", async () => {
    h.sendThrows = true
    const res = await POST(
      postRequest(
        "http://localhost/api/auth/welcome",
        { email: "neil@test.com", name: "Neil" },
        { "x-internal-secret": SECRET }
      )
    )
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.message).toBe("Failed to send welcome email")
  })
})
