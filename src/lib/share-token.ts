import { randomBytes } from "crypto"

// 32 random bytes → 43 base64url chars. Matches the share_token / token
// CHECK constraints (^[A-Za-z0-9_-]{32,64}$) on public link tables.
export function createShareToken(): string {
  return randomBytes(32).toString("base64url")
}

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/

export function isValidShareToken(token: string | null | undefined): token is string {
  return !!token && SHARE_TOKEN_RE.test(token)
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app").replace(/\/$/, "")
}

/** Public raise snapshot page. */
export function snapshotUrl(token: string) {
  return `${appUrl()}/s/${token}`
}

/** Public page where a connector accepts or declines an intro request. */
export function introLinkUrl(token: string) {
  return `${appUrl()}/i/${token}`
}
