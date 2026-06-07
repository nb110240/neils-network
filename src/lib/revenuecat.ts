import crypto from "node:crypto"

/**
 * Server-minted signed subscriber attribute for RevenueCat (defense in depth).
 *
 * The native client configures RevenueCat with appUserID = the Supabase user id
 * using the PUBLIC SDK key, so a modified client could set an arbitrary id. To
 * make app_user_id non-authoritative, the client fetches an HMAC of its own user
 * id from an authenticated endpoint and sets it as the `savvo_sig` subscriber
 * attribute. RevenueCat forwards subscriber attributes on the webhook, where we
 * recompute and constant-time compare. Only a session that legitimately holds
 * the account can produce a valid signature.
 *
 * The secret is optional so the feature degrades cleanly pre-launch: if
 * REVENUECAT_ATTRIBUTE_SECRET is unset, signing returns null (client skips the
 * attribute) and the webhook skips enforcement (documented degradation).
 */

/** True when a server secret is configured and enforcement is active. */
export function attributeVerificationEnabled(): boolean {
  return Boolean(process.env.REVENUECAT_ATTRIBUTE_SECRET)
}

/**
 * Sign a Supabase user id. Returns null when no secret is configured so callers
 * can cleanly skip setting the attribute.
 */
export function signSubscriberAttribute(userId: string): string | null {
  const secret = process.env.REVENUECAT_ATTRIBUTE_SECRET
  if (!secret) return null
  return crypto.createHmac("sha256", secret).update(userId).digest("hex")
}

/**
 * Verify a signature against a user id. Returns false when no secret is
 * configured or no signature is present (fail closed). Uses a constant-time
 * comparison, guarding equal length first since timingSafeEqual throws on
 * length mismatch (the length itself is not secret).
 */
export function verifySubscriberAttribute(
  userId: string,
  sig: string | null | undefined,
): boolean {
  const secret = process.env.REVENUECAT_ATTRIBUTE_SECRET
  // sig comes from untrusted webhook JSON: TS can't guarantee it's a string at
  // runtime, so guard explicitly (Buffer.from(non-string) has surprising
  // behavior). Empty/non-string always fails closed.
  if (!secret || typeof sig !== "string" || sig.length === 0) return false
  const expected = crypto
    .createHmac("sha256", secret)
    .update(userId)
    .digest("hex")
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
