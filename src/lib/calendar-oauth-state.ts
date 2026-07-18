import { createHmac, timingSafeEqual } from "node:crypto"

const STATE_TTL_MS = 10 * 60 * 1000
const CLOCK_SKEW_MS = 60 * 1000

function getOAuthStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET
  if (!secret) throw new Error("Missing OAUTH_STATE_SECRET; cannot sign OAuth state")
  return secret
}

export function signCalendarOAuthState(userId: string): string {
  const issuedAt = Date.now().toString(36)
  const payload = `${userId}.${issuedAt}`
  const signature = createHmac("sha256", getOAuthStateSecret())
    .update(payload)
    .digest("hex")

  return `${payload}.${signature}`
}

export function verifyCalendarOAuthState(state: string): string | null {
  const parts = state.split(".")
  if (parts.length !== 3) return null
  const [userId, issuedAtText, signature] = parts
  if (!userId || !issuedAtText || !signature) return null
  const issuedAt = Number.parseInt(issuedAtText, 36)
  if (!Number.isSafeInteger(issuedAt)) return null
  const age = Date.now() - issuedAt
  if (age < -CLOCK_SKEW_MS || age > STATE_TTL_MS) return null

  const payload = `${userId}.${issuedAtText}`
  const expected = createHmac("sha256", getOAuthStateSecret())
    .update(payload)
    .digest("hex")

  if (signature.length !== expected.length) return null
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? userId : null
}
