import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest } from "../helpers/mock-request"

const h = vi.hoisted(() => ({
  user: { id: "u1", email: "neil@savvo.app" } as { id: string; email: string } | null,
  rateLimitSuccess: true,
  upserts: [] as Array<{ row: unknown; options: unknown }>,
  deletes: [] as Array<[string, string]>,
  dbError: null as null | { message: string },
}))

const service = {
  from: vi.fn(() => ({
    upsert: vi.fn(async (row: unknown, options: unknown) => {
      h.upserts.push({ row, options })
      return { error: h.dbError }
    }),
    delete: vi.fn(() => ({
      eq: vi.fn(async (col: string, value: string) => {
        h.deletes.push([col, value])
        return { error: h.dbError }
      }),
    })),
  })),
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: h.user } })) } })),
  createServiceClient: vi.fn(async () => service),
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: h.rateLimitSuccess, limit: 10, remaining: 9, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

import { DELETE, POST } from "@/app/api/native/push-token/route"

const URL = "http://localhost/api/native/push-token"
const APNS_TOKEN = "a1b2c3d4".repeat(8)
const FCM_TOKEN = "dKx9_3:APA91bHuR-q0abcdefghijklmnop"

const post = (body: unknown) => POST(buildRequest({ url: URL, method: "POST", body }))
const del = (body: unknown) => DELETE(buildRequest({ url: URL, method: "DELETE", body }))

describe("/api/native/push-token", () => {
  beforeEach(() => {
    h.user = { id: "u1", email: "neil@savvo.app" }
    h.rateLimitSuccess = true
    h.upserts = []
    h.deletes = []
    h.dbError = null
  })

  it("requires a signed-in user to register", async () => {
    h.user = null
    expect((await post({ token: APNS_TOKEN, platform: "ios" })).status).toBe(401)
    expect(h.upserts).toHaveLength(0)
  })

  it("registers an iOS device to the signed-in user, re-assigning a token that belonged to someone else", async () => {
    const res = await post({ token: APNS_TOKEN, platform: "ios" })
    expect(res.status).toBe(200)
    expect(h.upserts).toEqual([{
      row: expect.objectContaining({ token: APNS_TOKEN, platform: "ios", user_id: "u1", last_seen_at: expect.any(String) }),
      options: { onConflict: "token" },
    }])
  })

  it("accepts Android FCM tokens", async () => {
    expect((await post({ token: FCM_TOKEN, platform: "android" })).status).toBe(200)
  })

  it.each([
    [{ token: APNS_TOKEN, platform: "web" }],
    [{ token: "short", platform: "ios" }],
    [{ token: "has spaces in it ok", platform: "ios" }],
    [{ token: APNS_TOKEN, platform: "ios", user_id: "someone-else" }],
    [null],
  ])("rejects a malformed registration %j", async (body) => {
    expect((await post(body)).status).toBe(400)
    expect(h.upserts).toHaveLength(0)
  })

  it("forgets a device by token on sign-out, without a session", async () => {
    h.user = null
    const res = await del({ token: APNS_TOKEN })
    expect(res.status).toBe(200)
    expect(h.deletes).toEqual([["token", APNS_TOKEN]])
  })

  it("rate limits forget requests", async () => {
    h.rateLimitSuccess = false
    expect((await del({ token: APNS_TOKEN })).status).toBe(429)
    expect(h.deletes).toHaveLength(0)
  })

  it("reports database failures", async () => {
    h.dbError = { message: "down" }
    expect((await post({ token: APNS_TOKEN, platform: "ios" })).status).toBe(500)
  })
})
