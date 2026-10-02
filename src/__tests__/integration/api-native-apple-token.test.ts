import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"

const h = vi.hoisted(() => ({
  user: { id: "u1", email: "x@privaterelay.appleid.com", app_metadata: { providers: ["apple"] } } as
    | { id: string; email: string; app_metadata: { providers: string[] } }
    | null,
  upserts: [] as unknown[],
  exchange: vi.fn(async () => "r.from-apple"),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: h.user } })) } })),
  createServiceClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      upsert: vi.fn(async (row: unknown) => {
        h.upserts.push(row)
        return { error: null }
      }),
    })),
  })),
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock("@/lib/apple/sign-in", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apple/sign-in")>("@/lib/apple/sign-in")
  return { ...actual, exchangeAppleAuthorizationCode: h.exchange }
})

import { POST } from "@/app/api/native/apple-token/route"

const URL = "http://localhost/api/native/apple-token"
const post = (body: unknown) => POST(buildRequest({ url: URL, method: "POST", body }))
const env = { ...process.env }

describe("POST /api/native/apple-token", () => {
  beforeEach(() => {
    h.user = { id: "u1", email: "x@privaterelay.appleid.com", app_metadata: { providers: ["apple"] } }
    h.upserts = []
    h.exchange.mockClear()
    process.env.APPLE_TEAM_ID = "TEAM456789"
    process.env.APPLE_SIWA_KEY_ID = "KEY"
    process.env.APPLE_SIWA_PRIVATE_KEY = "configured"
    process.env.APPLE_SERVICES_ID = "app.savvo.web"
    delete process.env.APPLE_BUNDLE_ID
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it("requires a session", async () => {
    h.user = null
    expect((await post({ authorizationCode: "c" })).status).toBe(401)
  })

  it("stores the refresh token from a native iOS sign-in under the bundle id", async () => {
    const res = await post({ authorizationCode: "code-1" })
    expect(await res.json()).toEqual({ stored: true })
    expect(h.exchange).toHaveBeenCalledWith("code-1", "app.savvo")
    expect(h.upserts).toEqual([expect.objectContaining({ user_id: "u1", client_id: "app.savvo", refresh_token: "r.from-apple" })])
  })

  it("exchanges under the app's own bundle id, ignoring any APPLE_BUNDLE_ID env", async () => {
    // Apple issued the code to the app's client_id; a different one fails with invalid_client.
    process.env.APPLE_BUNDLE_ID = "com.example.other"
    await post({ authorizationCode: "code-2" })
    expect(h.exchange).toHaveBeenCalledWith("code-2", "app.savvo")
  })

  it("stores an Android browser sign-in's refresh token under the web Services ID", async () => {
    await post({ refreshToken: "r.android" })
    expect(h.exchange).not.toHaveBeenCalled()
    expect(h.upserts).toEqual([expect.objectContaining({ client_id: "app.savvo.web", refresh_token: "r.android" })])
  })

  it("ignores accounts that never used Sign in with Apple", async () => {
    h.user = { id: "u1", email: "a@b.co", app_metadata: { providers: ["google"] } }
    expect((await post({ authorizationCode: "code-1" })).status).toBe(400)
    expect(h.upserts).toHaveLength(0)
  })

  it("does nothing, without failing, when Apple keys aren't configured", async () => {
    delete process.env.APPLE_SIWA_PRIVATE_KEY
    expect(await (await post({ authorizationCode: "code-1" })).json()).toEqual({ stored: false })
    expect(h.exchange).not.toHaveBeenCalled()
  })

  it("rejects bodies with both or neither field", async () => {
    expect((await post({})).status).toBe(400)
    expect((await post({ authorizationCode: "a", refreshToken: "b" })).status).toBe(400)
  })
})
