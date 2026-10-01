// Share-link tokens (/i/<token>, /s/<token>) are bearer credentials: anyone
// holding an intro link can answer it. Strip them from anything sent to
// third-party analytics.
const SHARE_TOKEN_PATH = /\/(i|s)\/[A-Za-z0-9_-]{16,}/g

export function redactShareTokens<T extends string | null | undefined>(value: T): T {
  if (typeof value !== "string") return value
  return value.replace(SHARE_TOKEN_PATH, "/$1/[token]") as T
}
