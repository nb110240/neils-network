// ─── Centralized environment variable access ───
//
// Two patterns:
// - requireEnv(name): throws a clear, actionable error if the var is missing.
//   Use at point of use for server-only config a route genuinely cannot run
//   without — turns a cryptic "undefined is not a string" into a real message.
// - validateEnv(): checks every required var at once. Called from
//   instrumentation.register() so a misconfigured deploy surfaces ONE clear log
//   line (and a Sentry alert) at boot instead of cryptic per-request 500s.

// Server-side vars the app fundamentally cannot function without.
// Conservative on purpose: only vars the running production app already
// depends on. Purely feature-scoped vars (Google OAuth, Resend) are validated
// at their own call sites and degrade gracefully.
const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  // Used app-wide for redirect URLs (Stripe checkout/portal, OAuth callbacks)
  // and outbound email links — several call sites use it with no fallback.
  "NEXT_PUBLIC_APP_URL",
  // Authenticates Vercel cron calls (daily digest, calendar sync, cleanup).
  // Missing or invalid = cron requests return 401. OAuth state is signed with
  // OAUTH_STATE_SECRET only; calendar-oauth-state.ts throws without it (no
  // CRON_SECRET fallback).
  "CRON_SECRET",
] as const

// A whitespace-only value (blank paste, stray space) counts as missing: it
// passes a bare truthiness check but fails downstream HMAC / API / URL use.
function isPresent(value: string | undefined): boolean {
  return !!value && value.trim() !== ""
}

/**
 * Returns the env var or throws a clear, actionable error if it is missing.
 * Use for server-only config a code path cannot proceed without.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!isPresent(value)) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (local dev) or the Vercel project settings (production).`
    )
  }
  return value as string
}

/**
 * Checks all required env vars in one pass. Returns the list of missing ones.
 * Does not throw — the caller decides how loudly to fail.
 */
export function validateEnv(): { ok: boolean; missing: string[] } {
  const missing = REQUIRED_ENV.filter((name) => !isPresent(process.env[name]))
  return { ok: missing.length === 0, missing }
}
