import { redactShareTokens } from "@/lib/redact-url"

// Share-link tokens (/i/<token>, /s/<token>) are bearer credentials. Sentry
// can pick them up in many places: request.url, transaction names, navigation
// breadcrumbs (from/to), fetch/xhr breadcrumb urls, span descriptions, replay
// frames. Rather than enumerate every field, walk the payload and redact every
// string. The regex only matches the share path shape, so other data is left
// untouched.

const MAX_DEPTH = 12

function walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactShareTokens(value)
  if (value === null || typeof value !== "object" || depth > MAX_DEPTH) return value
  if (seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = walk(value[i], depth + 1, seen)
    return value
  }
  // Only plain objects: leave class instances (Error, Date, DOM nodes) alone.
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return value
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) {
    record[key] = walk(record[key], depth + 1, seen)
  }
  return value
}

/** Redacts share tokens from every string in a Sentry payload, in place. */
export function redactSentryPayload<T>(payload: T): T {
  return walk(payload, 0, new WeakSet()) as T
}

/** True on a public share page, where the URL itself carries the token. */
export function isShareTokenPath(pathname: string | undefined | null): boolean {
  return typeof pathname === "string" && /^\/(i|s)\/[^/]+/.test(pathname)
}

/**
 * Shared Sentry.init options for client, server and edge. Spread into
 * Sentry.init({ ...sentryRedactionOptions, ... }).
 */
export const sentryRedactionOptions = {
  beforeSend: <T>(event: T): T => redactSentryPayload(event),
  beforeSendTransaction: <T>(event: T): T => redactSentryPayload(event),
  beforeBreadcrumb: <T>(breadcrumb: T): T => redactSentryPayload(breadcrumb),
}
