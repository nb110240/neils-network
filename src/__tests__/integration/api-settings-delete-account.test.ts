import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
  revokeApple: vi.fn(async () => undefined),
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

vi.mock("@/lib/apple/sign-in", () => ({
  isAppleSignInConfigured: vi.fn(() => true),
  revokeAppleToken: h.revokeApple,
}))

import { DELETE } from "@/app/api/settings/delete-account/route"

describe("DELETE /api/settings/delete-account", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
  })

  it("rejects unauthenticated requests with 401", async () => {
    h.supabase = createMockSupabase({ authUser: null })
    const res = await DELETE()
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    h.rateLimitSuccess = false
    const res = await DELETE()
    expect(res.status).toBe(429)
  })

  it("deletes the account on the happy path", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      rpcResult: { data: null, error: null },
    })
    const res = await DELETE()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    // both the data-purge RPC and the auth-user deletion must have run
    expect(h.supabase!.rpc).toHaveBeenCalledWith("delete_user_account", {
      target_user_id: "u1",
    })
    expect(h.supabase!.from).toHaveBeenCalledWith("user_preferences")
    expect(h.supabase!.from).toHaveBeenCalledWith("tags")
    expect(h.supabase!._queryBuilder.delete).toHaveBeenCalledTimes(2)
    expect(h.supabase!.auth.admin.deleteUser).toHaveBeenCalledWith("u1")
    expect(h.supabase!.auth.signOut).toHaveBeenCalled()
  })

  it("returns 500 when the data-purge RPC fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      rpcResult: { data: null, error: { message: "transaction aborted" } },
    })
    const res = await DELETE()
    expect(res.status).toBe(500)
    // auth user must NOT be deleted if the data purge failed
    expect(h.supabase!.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it("returns 500 when residual data cleanup fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      rpcResult: { data: null, error: null },
      queryResult: { data: null, error: { message: "residual row locked" } },
    })
    const res = await DELETE()
    expect(res.status).toBe(500)
    expect(h.supabase!.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it("returns 500 when the auth-user deletion fails", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      rpcResult: { data: null, error: null },
    })
    h.supabase.auth.admin.deleteUser = vi.fn().mockResolvedValue({
      error: { message: "auth delete failed" },
    })
    const res = await DELETE()
    expect(res.status).toBe(500)
  })
})

describe("DELETE /api/settings/delete-account with Sign in with Apple", () => {
  beforeEach(() => {
    h.rateLimitSuccess = true
    h.revokeApple.mockReset()
    h.revokeApple.mockResolvedValue(undefined)
  })

  it("revokes the Apple token before the user is deleted (App Review 5.1.1(v))", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { client_id: "app.savvo", refresh_token: "r.apple" }, error: null },
    })
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(h.supabase!.from).toHaveBeenCalledWith("apple_sign_in_tokens")
    expect(h.revokeApple).toHaveBeenCalledWith("r.apple", "app.savvo")
    expect(h.revokeApple.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(h.supabase!.auth.admin.deleteUser).mock.invocationCallOrder[0]
    )
  })

  it("still deletes the account when Apple's revoke call fails", async () => {
    h.revokeApple.mockRejectedValue(new Error("Apple token revoke failed (503)"))
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { client_id: "app.savvo", refresh_token: "r.apple" }, error: null },
    })
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(h.supabase!.auth.admin.deleteUser).toHaveBeenCalledWith("u1")
  })

  it("skips revocation for accounts without an Apple token", async () => {
    h.supabase = createMockSupabase({ authUser: { id: "u1" } })
    await DELETE()
    expect(h.revokeApple).not.toHaveBeenCalled()
  })
})
