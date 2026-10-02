import { beforeEach, describe, expect, it, vi } from "vitest"

// Regression: referral claims only ran in /auth/callback, so native iOS
// Google sign-in (in-app code exchange) and autoconfirm signups never
// credited the referrer.

type User = { id: string; user_metadata?: Record<string, unknown> }

const h = vi.hoisted(() => ({
  user: null as User | null,
  cookie: undefined as string | undefined,
  rateLimitOk: true,
  rpc: vi.fn(async () => ({ data: "claimed" as unknown, error: null as null | { message: string } })),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: h.user } })) },
  })),
  createServiceClient: vi.fn(async () => ({ rpc: h.rpc })),
}))
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === "savvo_ref" && h.cookie !== undefined ? { name, value: h.cookie } : undefined),
  })),
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: h.rateLimitOk, limit: 10, remaining: 9, reset: 0 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

import { POST } from "@/app/api/referrals/claim/route"
import { claimReferralOnce } from "@/lib/referral-claim"

const USER_ID = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  h.user = { id: USER_ID, user_metadata: {} }
  h.cookie = undefined
  h.rateLimitOk = true
  h.rpc.mockClear()
  h.rpc.mockResolvedValue({ data: "claimed", error: null })
})

describe("POST /api/referrals/claim", () => {
  it("rejects anonymous callers", async () => {
    h.user = null
    const res = await POST()
    expect(res.status).toBe(401)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it("is rate limited", async () => {
    h.rateLimitOk = false
    h.user = { id: USER_ID, user_metadata: { referral_code: "wxyz6789" } }
    const res = await POST()
    expect(res.status).toBe(429)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it("claims the code saved in signup metadata (native / autoconfirm sign-in)", async () => {
    h.user = { id: USER_ID, user_metadata: { referral_code: "wxyz6789" } }
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "claimed" })
    expect(h.rpc).toHaveBeenCalledWith("claim_referral", { p_code: "wxyz6789", p_referred_user_id: USER_ID })
  })

  it("prefers the savvo_ref cookie and clears it", async () => {
    h.cookie = "abcd2345"
    h.user = { id: USER_ID, user_metadata: { referral_code: "wxyz6789" } }
    const res = await POST()
    expect(h.rpc).toHaveBeenCalledWith("claim_referral", { p_code: "abcd2345", p_referred_user_id: USER_ID })
    expect(res.headers.get("set-cookie")).toMatch(/savvo_ref=;/)
  })

  it("passes through the RPC's rejection (old account, self, duplicate)", async () => {
    h.user = { id: USER_ID, user_metadata: { referral_code: "wxyz6789" } }
    h.rpc.mockResolvedValue({ data: "not_new", error: null })
    expect(await (await POST()).json()).toEqual({ status: "not_new" })
  })

  it("does nothing without a valid code", async () => {
    h.cookie = "%E0%A4%A"
    h.user = { id: USER_ID, user_metadata: { referral_code: "x;y" } }
    const res = await POST()
    expect(await res.json()).toEqual({ status: "no_code" })
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it("returns 500 when the RPC errors", async () => {
    h.user = { id: USER_ID, user_metadata: { referral_code: "wxyz6789" } }
    h.rpc.mockResolvedValue({ data: null, error: { message: "boom" } })
    expect((await POST()).status).toBe(500)
  })
})

describe("claimReferralOnce", () => {
  function memoryStorage() {
    const map = new Map<string, string>()
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    }
  }
  const user = { id: USER_ID, user_metadata: { referral_code: "wxyz6789" } }

  it("calls the endpoint once per user per device, even when called concurrently", async () => {
    const storage = memoryStorage()
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }))
    await Promise.all([
      claimReferralOnce(user, { storage, fetchImpl, cookieCode: null }),
      claimReferralOnce(user, { storage, fetchImpl, cookieCode: null }),
    ])
    await claimReferralOnce(user, { storage, fetchImpl, cookieCode: null })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith("/api/referrals/claim", expect.objectContaining({ method: "POST" }))
  })

  it("skips the request when there is no code to claim", async () => {
    const fetchImpl = vi.fn()
    await claimReferralOnce({ id: USER_ID, user_metadata: {} }, { storage: memoryStorage(), fetchImpl, cookieCode: null })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("uses the cookie code when metadata has none", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }))
    await claimReferralOnce({ id: USER_ID }, { storage: memoryStorage(), fetchImpl, cookieCode: "abcd2345" })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("retries on a later load after a transient failure", async () => {
    const storage = memoryStorage()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
    await claimReferralOnce(user, { storage, fetchImpl, cookieCode: null })
    await claimReferralOnce(user, { storage, fetchImpl, cookieCode: null })
    await claimReferralOnce(user, { storage, fetchImpl, cookieCode: null })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("retries on a later load after a 401 (session not ready yet)", async () => {
    // Regression: a 401 left the per-user flag set, so the claim was skipped
    // on every later, authenticated load on that device.
    const storage = memoryStorage()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
    await claimReferralOnce(user, { storage, fetchImpl, cookieCode: null })
    await claimReferralOnce(user, { storage, fetchImpl, cookieCode: null })
    await claimReferralOnce(user, { storage, fetchImpl, cookieCode: null })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
