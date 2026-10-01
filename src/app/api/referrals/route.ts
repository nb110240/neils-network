import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { createServiceClient } from "@/lib/supabase/server"
import { getOrCreateReferralCode } from "@/lib/referrals-server"
import { REFERRAL_REWARD_CAP, REFERRAL_REWARD_DAYS, referralUrl } from "@/lib/referrals"
import { getProCreditUntil } from "@/lib/subscription"

export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const service = await createServiceClient()
    const [code, { data: referrals, error }, proCreditUntil] = await Promise.all([
      getOrCreateReferralCode(service, user.id),
      // RLS limits this to referrals where the caller is the referrer.
      supabase.from("referrals").select("status").eq("referrer_id", user.id),
      getProCreditUntil(user.id),
    ])
    if (error) return errorResponse("Could not load your referrals")

    const rows = referrals || []
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"
    return NextResponse.json({
      code,
      url: referralUrl(appUrl, code),
      signedUp: rows.length,
      rewarded: rows.filter((r) => r.status === "rewarded").length,
      rewardDays: REFERRAL_REWARD_DAYS,
      rewardCap: REFERRAL_REWARD_CAP,
      proCreditUntil:
        proCreditUntil && proCreditUntil > new Date() ? proCreditUntil.toISOString() : null,
    })
  } catch (error) {
    console.error("Referrals GET error:", error)
    return errorResponse("Could not load your referrals")
  }
}
