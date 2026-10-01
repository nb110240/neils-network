// Client-safe referral helpers. Server-only code lives in referrals-server.ts.

export const REFERRAL_COOKIE = "savvo_ref"
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
export const REFERRAL_REWARD_DAYS = 30
export const REFERRAL_REWARD_CAP = 12

const CODE_RE = /^[a-z0-9]{8}$/

export function isValidReferralCode(code: string | null | undefined): code is string {
  return !!code && CODE_RE.test(code)
}

/** Reads the referral cookie in the browser (it is not httpOnly: codes are public). */
export function readReferralCodeFromDocument(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE}=([^;]*)`))
  const code = match ? decodeURIComponent(match[1]) : null
  return isValidReferralCode(code) ? code : null
}

export function referralUrl(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/$/, "")}/r/${code}`
}

