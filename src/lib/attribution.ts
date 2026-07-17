const STORAGE_KEY = "savvo-first-touch"
export const ATTRIBUTION_COOKIE = "savvo_first_touch"

const MAX_VALUE_LENGTH = 120
const MAX_PATH_LENGTH = 500
const COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const

export interface FirstTouchAttribution {
  source: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
  landing_path: string
  captured_at: string
  referrer_origin?: string
}

function cleanValue(value: unknown, maxLength = MAX_VALUE_LENGTH): string | undefined {
  if (typeof value !== "string") return undefined
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength)
  return cleaned || undefined
}

function cleanPath(value: unknown): string {
  const path = cleanValue(value, MAX_PATH_LENGTH)
  return path?.startsWith("/") ? path : "/"
}

function referrerOrigin(referrer: string | undefined): string | undefined {
  if (!referrer) return undefined
  try {
    const origin = new URL(referrer).origin
    return origin === "null" ? undefined : cleanValue(origin)
  } catch {
    return undefined
  }
}

export function parseAttribution(
  input: string | URL,
  capturedAt = new Date().toISOString(),
  referrer?: string
): FirstTouchAttribution | null {
  let url: URL
  try {
    url = input instanceof URL ? input : new URL(input, "https://savvo.app")
  } catch {
    return null
  }

  const source = cleanValue(url.searchParams.get("utm_source"))
  if (!source) return null

  const trackedParams = new URLSearchParams()
  for (const key of UTM_KEYS) {
    const value = cleanValue(url.searchParams.get(key))
    if (value) trackedParams.set(key, value)
  }
  const query = trackedParams.toString()

  return {
    source,
    medium: cleanValue(url.searchParams.get("utm_medium")),
    campaign: cleanValue(url.searchParams.get("utm_campaign")),
    term: cleanValue(url.searchParams.get("utm_term")),
    content: cleanValue(url.searchParams.get("utm_content")),
    // Keep the useful campaign parameters, but never persist unrelated query
    // values that could contain an email address, auth code, or other PII.
    landing_path: cleanPath(`${url.pathname}${query ? `?${query}` : ""}`),
    captured_at: Number.isNaN(Date.parse(capturedAt))
      ? new Date().toISOString()
      : capturedAt,
    referrer_origin: referrerOrigin(referrer),
  }
}

export function validateAttribution(value: unknown): FirstTouchAttribution | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Record<string, unknown>
  const source = cleanValue(candidate.source)
  const capturedAt = cleanValue(candidate.captured_at)
  if (!source || !capturedAt || Number.isNaN(Date.parse(capturedAt))) return null

  return {
    source,
    medium: cleanValue(candidate.medium),
    campaign: cleanValue(candidate.campaign),
    term: cleanValue(candidate.term),
    content: cleanValue(candidate.content),
    landing_path: cleanPath(candidate.landing_path),
    captured_at: capturedAt,
    referrer_origin: referrerOrigin(cleanValue(candidate.referrer_origin)),
  }
}

function readStoredAttribution(): FirstTouchAttribution | null {
  if (typeof window === "undefined") return null
  try {
    return validateAttribution(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null"))
  } catch {
    return null
  }
}

function writeCookie(attribution: FirstTouchAttribution) {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(attribution))}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

export function getFirstTouchAttribution(): FirstTouchAttribution | null {
  return readStoredAttribution()
}

export function clearFirstTouchAttribution() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage is optional.
  }
  if (typeof document !== "undefined") {
    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie = `${ATTRIBUTION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
  }
}

export function persistFirstTouchAttribution(
  attribution: FirstTouchAttribution | null
): FirstTouchAttribution | null {
  const existing = readStoredAttribution()
  if (existing) {
    writeCookie(existing)
    return existing
  }
  if (!attribution || typeof window === "undefined") return null

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution))
    writeCookie(attribution)
  } catch {
    // The caller can still attach the in-memory value to the current event.
  }
  return attribution
}

export function restoreAuthenticatedAttribution(
  attribution: FirstTouchAttribution
): FirstTouchAttribution {
  if (typeof window === "undefined") return attribution
  try {
    // Once signed in, auth metadata is the authoritative first touch for that
    // account and must replace attribution left by another browser user.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution))
    writeCookie(attribution)
  } catch {
    // The in-memory attribution remains usable for the current event.
  }
  return attribution
}

export function captureFirstTouchAttribution(
  input: string | URL,
  referrer?: string
): {
  firstTouch: FirstTouchAttribution | null
  currentTouch: FirstTouchAttribution | null
  isNew: boolean
} {
  const currentTouch = parseAttribution(input, new Date().toISOString(), referrer)
  const existing = readStoredAttribution()

  if (existing) {
    // Refresh the server-readable copy without ever replacing first touch.
    writeCookie(existing)
    return { firstTouch: existing, currentTouch, isNew: false }
  }

  if (!currentTouch || typeof window === "undefined") {
    return { firstTouch: null, currentTouch, isNew: false }
  }

  persistFirstTouchAttribution(currentTouch)
  return { firstTouch: currentTouch, currentTouch, isNew: true }
}

export function attributionFromCookieHeader(
  cookieHeader: string | null | undefined
): FirstTouchAttribution | null {
  if (!cookieHeader) return null
  const encoded = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ATTRIBUTION_COOKIE}=`))
    ?.slice(ATTRIBUTION_COOKIE.length + 1)
  if (!encoded) return null

  try {
    return validateAttribution(JSON.parse(decodeURIComponent(encoded)))
  } catch {
    return null
  }
}

export function attributionEventProperties(
  attribution: FirstTouchAttribution | null,
  prefix = "first_touch_"
): Record<string, string> {
  if (!attribution) return {}
  const properties: Record<string, string> = {
    [`${prefix}source`]: attribution.source,
    [`${prefix}landing_path`]: attribution.landing_path,
    [`${prefix}captured_at`]: attribution.captured_at,
  }
  if (attribution.medium) properties[`${prefix}medium`] = attribution.medium
  if (attribution.campaign) properties[`${prefix}campaign`] = attribution.campaign
  if (attribution.term) properties[`${prefix}term`] = attribution.term
  if (attribution.content) properties[`${prefix}content`] = attribution.content
  if (attribution.referrer_origin) {
    properties[`${prefix}referrer_origin`] = attribution.referrer_origin
  }
  return properties
}

export function attributionUserMetadata(
  attribution: FirstTouchAttribution | null
): Record<string, string> {
  return attributionEventProperties(attribution)
}

export function attributionFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined
): FirstTouchAttribution | null {
  if (!metadata) return null
  return validateAttribution({
    source: metadata.first_touch_source,
    medium: metadata.first_touch_medium,
    campaign: metadata.first_touch_campaign,
    term: metadata.first_touch_term,
    content: metadata.first_touch_content,
    landing_path: metadata.first_touch_landing_path,
    captured_at: metadata.first_touch_captured_at,
    referrer_origin: metadata.first_touch_referrer_origin,
  })
}

export function resolveAuthenticatedAttribution(
  savedFirstTouch: FirstTouchAttribution | null,
  browserFirstTouch: FirstTouchAttribution | null,
  userCreatedAt: string,
  now = Date.now()
): {
  firstTouch: FirstTouchAttribution | null
  shouldClearBrowser: boolean
} {
  if (savedFirstTouch) {
    return { firstTouch: savedFirstTouch, shouldClearBrowser: false }
  }

  const createdAt = new Date(userCreatedAt).getTime()
  const isNewlyCreated =
    Number.isFinite(createdAt) && now - createdAt < NEW_ACCOUNT_WINDOW_MS
  if (isNewlyCreated) {
    return { firstTouch: browserFirstTouch, shouldClearBrowser: false }
  }

  return {
    firstTouch: null,
    shouldClearBrowser: browserFirstTouch !== null,
  }
}
