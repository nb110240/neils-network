import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Web Sign in with Apple: /auth/callback keeps Apple's refresh token so
// account deletion can revoke it later.

const h = vi.hoisted(() => ({
  session: null as unknown,
  upserts: [] as unknown[],
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: vi.fn(async () => h.session),
      updateUser: vi.fn(async () => ({ error: null })),
    },
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: vi.fn(() => ({
      upsert: vi.fn(async (row: unknown) => {
        h.upserts.push(row)
        return { error: null }
      }),
    })),
  })),
}))
vi.mock("@vercel/analytics/server", () => ({ track: vi.fn() }))

import { GET } from "@/app/auth/callback/route"

function signedIn(providers: string[], providerRefreshToken: string | null) {
  return {
    data: {
      // An existing account, so no welcome email is attempted.
      user: { id: "u1", email: "x@privaterelay.appleid.com", created_at: "2026-01-01T00:00:00Z", app_metadata: { provider: providers[0], providers }, user_metadata: {} },
      session: { provider_refresh_token: providerRefreshToken },
    },
    error: null,
  }
}

const env = { ...process.env }

describe("/auth/callback with Sign in with Apple", () => {
  beforeEach(() => {
    h.upserts = []
    process.env.APPLE_SERVICES_ID = "app.savvo.web"
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it("stores Apple's refresh token for an Apple sign-in and still lands on the dashboard", async () => {
    h.session = signedIn(["apple"], "r.apple-web")
    const res = await GET(new Request("https://savvo.app/auth/callback?provider=apple&code=abc"))
    expect(res.headers.get("location")).toBe("https://savvo.app/dashboard")
    expect(h.upserts).toEqual([expect.objectContaining({ user_id: "u1", client_id: "app.savvo.web", refresh_token: "r.apple-web" })])
  })

  it("ignores the token from another provider's sign-in", async () => {
    // Linked account signing in with Google: the provider token is Google's.
    h.session = signedIn(["apple", "google"], "google-refresh")
    await GET(new Request("https://savvo.app/auth/callback?code=abc"))
    expect(h.upserts).toHaveLength(0)
  })

  it("ignores a spoofed ?provider=apple on an account without Apple", async () => {
    h.session = signedIn(["google"], "google-refresh")
    await GET(new Request("https://savvo.app/auth/callback?provider=apple&code=abc"))
    expect(h.upserts).toHaveLength(0)
  })

  it("skips storage until the Services ID is configured", async () => {
    delete process.env.APPLE_SERVICES_ID
    h.session = signedIn(["apple"], "r.apple-web")
    await GET(new Request("https://savvo.app/auth/callback?provider=apple&code=abc"))
    expect(h.upserts).toHaveLength(0)
  })
})
