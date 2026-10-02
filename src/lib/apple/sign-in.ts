import { parseApplePrivateKey, signEs256Jwt } from "./jwt"

// Server side of Sign in with Apple: turns an authorization code into a
// refresh token we keep, and revokes it when the account is deleted, as App
// Review guideline 5.1.1(v) requires for apps offering Sign in with Apple.
//
// Env:
//   APPLE_TEAM_ID           10-character Apple Developer Team ID
//   APPLE_SIWA_KEY_ID       Key ID of a key with "Sign in with Apple" enabled
//   APPLE_SIWA_PRIVATE_KEY  that key's .p8 contents
//   APPLE_SERVICES_ID       Services ID used by the web OAuth flow
//   APPLE_BUNDLE_ID         iOS bundle id, the client_id for the native flow
//                           (defaults to app.savvo)

const APPLE_AUTH_BASE = "https://appleid.apple.com"

export const DEFAULT_APPLE_BUNDLE_ID = "app.savvo"

export function appleBundleId(): string {
  return process.env.APPLE_BUNDLE_ID || DEFAULT_APPLE_BUNDLE_ID
}

export function appleServicesId(): string | null {
  return process.env.APPLE_SERVICES_ID || null
}

export function isAppleSignInConfigured(): boolean {
  return Boolean(process.env.APPLE_TEAM_ID && process.env.APPLE_SIWA_KEY_ID && process.env.APPLE_SIWA_PRIVATE_KEY)
}

/** Short-lived client secret for Apple's token endpoints. */
export function appleClientSecret(clientId: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const teamId = process.env.APPLE_TEAM_ID
  const keyId = process.env.APPLE_SIWA_KEY_ID
  const privateKey = process.env.APPLE_SIWA_PRIVATE_KEY
  if (!teamId || !keyId || !privateKey) throw new Error("Sign in with Apple is not configured")
  return signEs256Jwt(
    { kid: keyId },
    { iss: teamId, iat: nowSeconds, exp: nowSeconds + 300, aud: APPLE_AUTH_BASE, sub: clientId },
    parseApplePrivateKey(privateKey)
  )
}

type FetchLike = typeof fetch

/** Exchanges a one-time authorization code for Apple's refresh token. */
export async function exchangeAppleAuthorizationCode(
  code: string,
  clientId: string,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  const res = await fetchImpl(`${APPLE_AUTH_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: appleClientSecret(clientId),
      code,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await res.json().catch(() => ({}))) as { refresh_token?: unknown; error?: unknown }
  if (!res.ok || typeof data.refresh_token !== "string") {
    throw new Error(`Apple token exchange failed (${res.status}${typeof data.error === "string" ? `: ${data.error}` : ""})`)
  }
  return data.refresh_token
}

/** Revokes a stored refresh token. Apple answers 200 even for unknown tokens. */
export async function revokeAppleToken(
  refreshToken: string,
  clientId: string,
  fetchImpl: FetchLike = fetch
): Promise<void> {
  const res = await fetchImpl(`${APPLE_AUTH_BASE}/auth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: appleClientSecret(clientId),
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Apple token revoke failed (${res.status})`)
}
