import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generateKeyPairSync, verify } from "node:crypto"
import { appleClientSecret, exchangeAppleAuthorizationCode, revokeAppleToken } from "@/lib/apple/sign-in"

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })

function fakeFetch(status: number, body: unknown) {
  return vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(body), { status }))
}

describe("Sign in with Apple server calls", () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.APPLE_TEAM_ID = "TEAM456789"
    process.env.APPLE_SIWA_KEY_ID = "SIWAKEY123"
    process.env.APPLE_SIWA_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it("signs a client secret Apple accepts: ES256, team as issuer, client id as subject, 5 minute life", () => {
    const secret = appleClientSecret("app.savvo", 1700000000)
    const [head, body, sig] = secret.split(".")
    expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({ alg: "ES256", kid: "SIWAKEY123" })
    expect(JSON.parse(Buffer.from(body, "base64url").toString())).toEqual({
      iss: "TEAM456789",
      iat: 1700000000,
      exp: 1700000300,
      aud: "https://appleid.apple.com",
      sub: "app.savvo",
    })
    expect(verify("sha256", Buffer.from(`${head}.${body}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url"))).toBe(true)
  })

  it("exchanges an authorization code for the refresh token", async () => {
    const fetchImpl = fakeFetch(200, { refresh_token: "r.abc", access_token: "a.abc" })
    await expect(exchangeAppleAuthorizationCode("code-1", "app.savvo", fetchImpl)).resolves.toBe("r.abc")
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("https://appleid.apple.com/auth/token")
    const form = new URLSearchParams(String(init?.body))
    expect(form.get("grant_type")).toBe("authorization_code")
    expect(form.get("code")).toBe("code-1")
    expect(form.get("client_id")).toBe("app.savvo")
    expect(form.get("client_secret")?.split(".")).toHaveLength(3)
  })

  it("fails loudly when Apple rejects the code", async () => {
    await expect(exchangeAppleAuthorizationCode("bad", "app.savvo", fakeFetch(400, { error: "invalid_grant" })))
      .rejects.toThrow("invalid_grant")
  })

  it("revokes a refresh token with the matching client id", async () => {
    const fetchImpl = fakeFetch(200, {})
    await revokeAppleToken("r.abc", "com.savvo.web", fetchImpl)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("https://appleid.apple.com/auth/revoke")
    const form = new URLSearchParams(String(init?.body))
    expect(form.get("token")).toBe("r.abc")
    expect(form.get("token_type_hint")).toBe("refresh_token")
    expect(form.get("client_id")).toBe("com.savvo.web")
  })

  it("refuses to sign without keys", () => {
    delete process.env.APPLE_SIWA_PRIVATE_KEY
    expect(() => appleClientSecret("app.savvo")).toThrow("not configured")
  })
})
