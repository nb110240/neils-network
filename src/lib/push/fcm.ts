import { createPrivateKey, sign } from "node:crypto"
import type { PushMessage, PushSendResult } from "./types"

// Firebase Cloud Messaging HTTP v1 for Android devices.
//
// Env:
//   FCM_SERVICE_ACCOUNT  the Firebase service account JSON (project_id,
//                        client_email, private_key), as one line
//   FCM_ENDPOINT         override for the send URL base, used by tests

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging"

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

export function fcmServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null
    return { project_id: parsed.project_id, client_email: parsed.client_email, private_key: parsed.private_key }
  } catch {
    return null
  }
}

let cachedAccessToken: { value: string; email: string; expiresAt: number } | null = null

export function resetFcmTokenCache() {
  cachedAccessToken = null
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url")
}

/** Google OAuth "JWT bearer" assertion signed with the service account key. */
export function serviceAccountAssertion(account: ServiceAccount, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const head = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const body = base64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 })
  )
  const key = createPrivateKey(account.private_key.replace(/\\n/g, "\n"))
  const signature = sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key)
  return `${head}.${body}.${base64url(signature)}`
}

async function accessToken(account: ServiceAccount, fetchImpl: typeof fetch): Promise<string> {
  const now = Date.now()
  if (cachedAccessToken && cachedAccessToken.email === account.client_email && cachedAccessToken.expiresAt > now) {
    return cachedAccessToken.value
  }
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: serviceAccountAssertion(account),
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await res.json().catch(() => ({}))) as { access_token?: unknown; expires_in?: unknown }
  if (!res.ok || typeof data.access_token !== "string") throw new Error(`FCM auth failed (${res.status})`)
  const ttl = typeof data.expires_in === "number" ? data.expires_in : 3600
  cachedAccessToken = { value: data.access_token, email: account.client_email, expiresAt: now + (ttl - 60) * 1000 }
  return data.access_token
}

export function fcmMessage(token: string, message: PushMessage) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      ...(message.url ? { data: { url: message.url } } : {}),
      android: {
        priority: "high",
        // Undelivered after a day is stale.
        ttl: "86400s",
        notification: { ...(message.threadId ? { tag: message.threadId } : {}) },
      },
    },
  }
}

function isDeadTokenError(status: number, body: unknown): boolean {
  if (status === 404) return true
  const error = (body as { error?: { status?: string; details?: Array<{ errorCode?: string }> } })?.error
  const codes = [error?.status, ...(error?.details ?? []).map((d) => d.errorCode)]
  return codes.includes("UNREGISTERED") || (status === 400 && codes.includes("INVALID_ARGUMENT") && JSON.stringify(body).includes("registration token"))
}

/** Sends one notification to each registration token. Never throws. */
export async function sendFcm(
  registrationTokens: string[],
  message: PushMessage,
  fetchImpl: typeof fetch = fetch
): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, failed: 0, deadTokens: [] }
  if (registrationTokens.length === 0) return result
  const account = fcmServiceAccount()
  if (!account) {
    result.failed = registrationTokens.length
    return result
  }
  try {
    const bearer = await accessToken(account, fetchImpl)
    const base = process.env.FCM_ENDPOINT || "https://fcm.googleapis.com"
    const url = `${base}/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`
    for (const token of registrationTokens) {
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
          body: JSON.stringify(fcmMessage(token, message)),
          signal: AbortSignal.timeout(10_000),
        })
        if (res.ok) {
          result.sent++
          continue
        }
        result.failed++
        const body = await res.json().catch(() => null)
        if (isDeadTokenError(res.status, body)) result.deadTokens.push(token)
        if (res.status === 401) resetFcmTokenCache()
      } catch {
        result.failed++
      }
    }
  } catch {
    result.failed = registrationTokens.length - result.sent
  }
  return result
}
