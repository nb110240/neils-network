import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"

// ─── Route mocks ───
const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
  rateLimitSuccess: true,
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
