import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { REFERRAL_COOKIE, isValidReferralCode } from "@/lib/referrals"

// Claims a referral for the signed-in user. /auth/callback does this for web
// sign-ins, but native iOS Google sign-in exchanges its code inside the app
// and email-autoconfirm environments never hit the callback, so the client
// calls this once after sign-in. claim_referral() rejects self-referrals,
// accounts older than 7 days and duplicate claims, so repeat calls are safe.
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rl = await rateLimit(user.id, "auth")
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const cookieStore = await cookies()
    let cookieCode: string | null = null
    const rawCookie = cookieStore.get(REFERRAL_COOKIE)?.value
    if (rawCookie) {
      try {
        cookieCode = decodeURIComponent(rawCookie)
      } catch {
        cookieCode = null
      }
    }
    const metadataCode = user.user_metadata?.referral_code
    const code = isValidReferralCode(cookieCode)
      ? cookieCode
      : typeof metadataCode === "string" && isValidReferralCode(metadataCode)
        ? metadataCode
        : null

    if (!code) return NextResponse.json({ status: "no_code" })

    const service = await createServiceClient()
    const { data, error } = await service.rpc("claim_referral", {
      p_code: code,
      p_referred_user_id: user.id,
    })
    if (error) {
      console.error("Failed to claim referral:", error.message)
      return NextResponse.json({ error: "Could not claim referral" }, { status: 500 })
    }

    const response = NextResponse.json({ status: typeof data === "string" ? data : "unknown" })
    if (rawCookie !== undefined) response.cookies.delete(REFERRAL_COOKIE)
    return response
  } catch (error) {
    console.error("Referral claim error:", error)
    return NextResponse.json({ error: "Could not claim referral" }, { status: 500 })
  }
}
