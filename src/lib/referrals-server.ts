import { randomInt } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

// Lowercase, no look-alikes (0/o, 1/l/i) so codes survive being read aloud.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const CODE_LENGTH = 8

export function generateReferralCode(): string {
  let code = ""
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

/**
 * Returns the user's referral code, creating one on first use. Requires a
 * service-role client: referral_codes has no user-facing write policy.
 */
export async function getOrCreateReferralCode(
  service: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: existing } = await service
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle()
  if (existing?.code) return existing.code as string

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode()
    const { error } = await service.from("referral_codes").insert({ user_id: userId, code })
    if (!error) return code
    if (error.code !== "23505") throw new Error(`Could not create referral code: ${error.message}`)
    // 23505: either a code collision (retry) or a concurrent insert for
    // this user (read it back).
    const { data: raced } = await service
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .maybeSingle()
    if (raced?.code) return raced.code as string
  }
  throw new Error("Could not create a unique referral code")
}
