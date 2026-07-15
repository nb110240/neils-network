import { createHmac } from "node:crypto"

function getOAuthStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET
  if (!secret) throw new Error("Missing OAUTH_STATE_SECRET; cannot sign OAuth state")
  return secret
}

export function signCalendarOAuthState(userId: string): string {
  const signature = createHmac("sha256", getOAuthStateSecret())
    .update(userId)
    .digest("hex")
    .slice(0, 16)

  return `${userId}.${signature}`
}

export function verifyCalendarOAuthState(state: string): string | null {
  const [userId, signature] = state.split(".")
  if (!userId || !signature) return null

  const expected = createHmac("sha256", getOAuthStateSecret())
    .update(userId)
    .digest("hex")
    .slice(0, 16)

  return signature === expected ? userId : null
}
