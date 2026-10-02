import { isValidReferralCode, readReferralCodeFromDocument } from "@/lib/referrals"

const FLAG_PREFIX = "savvo:referral-claimed:"

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

/**
 * Asks the server to claim a pending referral for this user, at most once per
 * user per device. Skips the request entirely when there is no code to claim
 * (no savvo_ref cookie and no referral_code in signup metadata), so existing
 * users never pay for it. Never throws.
 */
export async function claimReferralOnce(
  user: { id: string; user_metadata?: Record<string, unknown> | null } | null | undefined,
  deps: {
    fetchImpl?: typeof fetch
    storage?: StorageLike | null
    cookieCode?: string | null
  } = {}
): Promise<void> {
  if (!user?.id) return
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage
  const key = FLAG_PREFIX + user.id
  try {
    if (storage?.getItem(key)) return
  } catch {
    /* storage blocked: fall through, the server is idempotent */
  }

  const cookieCode = deps.cookieCode === undefined ? readReferralCodeFromDocument() : deps.cookieCode
  const metadataCode = user.user_metadata?.referral_code
  const hasCode =
    isValidReferralCode(cookieCode) ||
    (typeof metadataCode === "string" && isValidReferralCode(metadataCode))
  if (!hasCode) return

  // Set the flag before the request so concurrent callers (native sign-in
  // followed by the dashboard mount) make a single call.
  try {
    storage?.setItem(key, String(Date.now()))
  } catch {
    /* ignore */
  }

  try {
    const res = await (deps.fetchImpl ?? fetch)("/api/referrals/claim", {
      method: "POST",
      credentials: "same-origin",
    })
    // Retry on a later load only when the failure was transient.
    if (res.status === 429 || res.status >= 500) storage?.removeItem(key)
  } catch {
    try {
      storage?.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}
