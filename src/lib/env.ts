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
// depends on. Feature-scoped vars (Google OAuth, Resend, cron secrets) are
// validated at their own call sites and degrade gracefully.
const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const

/**
 * Returns the env var or throws a clear, actionable error if it is missing.
 * Use for server-only config a code path cannot proceed without.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (local dev) or the Vercel project settings (production).`
    )
  }
  return value
}

/**
 * Checks all required env vars in one pass. Returns the list of missing ones.
 * Does not throw — the caller decides how loudly to fail.
 */
export function validateEnv(): { ok: boolean; missing: string[] } {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name])
  return { ok: missing.length === 0, missing }
}
