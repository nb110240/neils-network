import { connect, constants, type ClientHttp2Session } from "node:http2"
import { parseApplePrivateKey, signEs256Jwt } from "@/lib/apple/jwt"
import type { PushMessage, PushSendResult } from "./types"

// Apple Push Notification service over HTTP/2 with a token-based (.p8) key.
//
// Env:
//   APNS_KEY_ID        Key ID of a key with "Apple Push Notifications service" enabled
//   APNS_PRIVATE_KEY   that key's .p8 contents (can be the same key as Sign in with Apple)
//   APPLE_TEAM_ID      Apple Developer Team ID (APNS_TEAM_ID overrides)
//   APNS_BUNDLE_ID     topic, defaults to app.savvo
//   APNS_ENV           "production" (default; TestFlight and App Store builds) or "sandbox" (Xcode debug builds)
//   APNS_HOST          override, used by tests

const PRODUCTION_HOST = "https://api.push.apple.com"
const SANDBOX_HOST = "https://api.sandbox.push.apple.com"
// Apple rejects provider tokens older than an hour and throttles refreshes
// more often than every 20 minutes.
const TOKEN_TTL_MS = 50 * 60 * 1000
const REQUEST_TIMEOUT_MS = 10_000

// Reasons that mean the token will never work again and should be deleted.
const DEAD_TOKEN_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"])

interface ApnsConfig {
  keyId: string
  teamId: string
  privateKey: string
  topic: string
  host: string
}

export function apnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID || process.env.APPLE_TEAM_ID
  const privateKey = process.env.APNS_PRIVATE_KEY
  if (!keyId || !teamId || !privateKey) return null
  return {
    keyId,
    teamId,
    privateKey,
    topic: process.env.APNS_BUNDLE_ID || "app.savvo",
    host: process.env.APNS_HOST || (process.env.APNS_ENV === "sandbox" ? SANDBOX_HOST : PRODUCTION_HOST),
  }
}

let cachedToken: { value: string; keyId: string; expiresAt: number } | null = null

function providerToken(config: ApnsConfig, now = Date.now()): string {
  if (cachedToken && cachedToken.keyId === config.keyId && cachedToken.expiresAt > now) return cachedToken.value
  const value = signEs256Jwt(
    { kid: config.keyId },
    { iss: config.teamId, iat: Math.floor(now / 1000) },
    parseApplePrivateKey(config.privateKey)
  )
  cachedToken = { value, keyId: config.keyId, expiresAt: now + TOKEN_TTL_MS }
  return value
}

/** For tests: forget the cached provider token. */
export function resetApnsTokenCache() {
  cachedToken = null
}

export function apnsPayload(message: PushMessage): string {
  return JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: "default",
      ...(message.threadId ? { "thread-id": message.threadId } : {}),
    },
    ...(message.url ? { url: message.url } : {}),
  })
}

function sendOne(
  session: ClientHttp2Session,
  config: ApnsConfig,
  deviceToken: string,
  payload: string,
  jwt: string
): Promise<{ status: number; reason?: string }> {
  return new Promise((resolve) => {
    const req = session.request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": config.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      // Undelivered after a day is stale: drop it rather than buzz late.
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 24 * 60 * 60),
      "content-type": "application/json",
    })
    let status = 0
    let body = ""
    const timer = setTimeout(() => req.close(constants.NGHTTP2_CANCEL), REQUEST_TIMEOUT_MS)
    req.setEncoding("utf8")
    req.on("response", (headers) => {
      status = Number(headers[constants.HTTP2_HEADER_STATUS]) || 0
    })
    req.on("data", (chunk: string) => {
      body += chunk
    })
    const finish = () => {
      clearTimeout(timer)
      let reason: string | undefined
      try {
        reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined
      } catch {
        reason = undefined
      }
      resolve({ status, reason })
    }
    req.on("end", finish)
    req.on("close", finish)
    req.on("error", () => {
      clearTimeout(timer)
      resolve({ status: 0, reason: "request_error" })
    })
    req.end(payload)
  })
}

/** Sends one alert to each device token. Never throws. */
export async function sendApns(deviceTokens: string[], message: PushMessage): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, failed: 0, deadTokens: [] }
  if (deviceTokens.length === 0) return result
  const config = apnsConfig()
  if (!config) {
    result.failed = deviceTokens.length
    return result
  }

  let session: ClientHttp2Session | null = null
  try {
    const jwt = providerToken(config)
    const payload = apnsPayload(message)
    session = connect(config.host)
    session.on("error", () => {})
    for (const token of deviceTokens) {
      const { status, reason } = await sendOne(session, config, token, payload, jwt)
      if (status === 200) {
        result.sent++
      } else {
        result.failed++
        if (status === 410 || (reason && DEAD_TOKEN_REASONS.has(reason))) result.deadTokens.push(token)
        // A rejected provider token must not be reused for the next send.
        if (reason === "ExpiredProviderToken" || reason === "InvalidProviderToken") resetApnsTokenCache()
      }
    }
  } catch {
    result.failed = deviceTokens.length - result.sent
  } finally {
    session?.close()
  }
  return result
}
