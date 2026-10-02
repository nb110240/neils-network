import type { User } from "@supabase/supabase-js"

const DAY_MS = 24 * 60 * 60 * 1000
const ACTIVATION_WINDOW_DAYS = 14
/** The digest cron skips weekends, so step 1 can slip; keep the emails apart. */
const MIN_DAYS_BETWEEN = 2

/**
 * Which activation email (if any) a confirmed account with zero contacts
 * should get today: step 1 from day 1, step 2 from day 3 and at least two
 * days after step 1, each once, and nothing after the first two weeks.
 * State lives in app_metadata (server-only): activation_emails_sent and
 * activation_email_last_at.
 */
export function activationStep(user: Pick<User, "created_at" | "email_confirmed_at" | "app_metadata">, now = Date.now()): 1 | 2 | null {
  if (!user.email_confirmed_at) return null
  const ageDays = (now - new Date(user.created_at).getTime()) / DAY_MS
  if (ageDays < 1 || ageDays > ACTIVATION_WINDOW_DAYS) return null
  const sent = Number(user.app_metadata?.activation_emails_sent) || 0
  if (sent < 1) return 1
  if (sent >= 2 || ageDays < 3) return null
  const lastAt = Date.parse(String(user.app_metadata?.activation_email_last_at ?? ""))
  if (Number.isFinite(lastAt) && now - lastAt < MIN_DAYS_BETWEEN * DAY_MS) return null
  return 2
}
