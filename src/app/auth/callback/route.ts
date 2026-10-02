import { track } from "@vercel/analytics/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { REFERRAL_COOKIE, isValidReferralCode } from "@/lib/referrals"
import { appleServicesId } from "@/lib/apple/sign-in"
import {
  attributionEventProperties,
  attributionFromCookieHeader,
  attributionUserMetadata,
} from "@/lib/attribution"
import { NextResponse } from "next/server"

function readCookie(header: string | null, name: string): string | null {
  for (const part of (header || "").split(";")) {
    const [key, ...value] = part.trim().split("=")
    if (key === name) {
      // A malformed escape must not turn sign-in into a 500.
      try {
        return decodeURIComponent(value.join("="))
      } catch {
        return null
      }
    }
  }
  return null
}

// Attributes a new account to the referrer whose /r/<code> link set the
// cookie. claim_referral() rejects self-referrals and accounts older than
// 7 days, and is idempotent per referred user, so running it on every
// callback is safe. Never blocks sign-in.
async function claimReferral(code: string, userId: string) {
  try {
    const service = await createServiceClient()
    const { error } = await service.rpc("claim_referral", {
      p_code: code,
      p_referred_user_id: userId,
    })
    if (error) console.error("Failed to claim referral:", error.message)
  } catch {
    console.error("Failed to claim referral")
  }
}

async function storeAppleRefreshToken(userId: string, refreshToken: string) {
  const clientId = appleServicesId()
  if (!clientId) return
  try {
    const service = await createServiceClient()
    const { error } = await service.from("apple_sign_in_tokens").upsert(
      { user_id: userId, client_id: clientId, refresh_token: refreshToken, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    if (error) console.error("Failed to store Apple token:", error.message)
  } catch {
    console.error("Failed to store Apple token")
  }
}

function withReferralCookieCleared(response: NextResponse, hadCookie: boolean) {
  if (hadCookie) response.cookies.delete(REFERRAL_COOKIE)
  return response
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin
  const firstTouch = attributionFromCookieHeader(request.headers.get("cookie"))
  const referralCode = readCookie(request.headers.get("cookie"), REFERRAL_COOKIE)
  const hasReferralCookie = referralCode !== null

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Cookie first; user metadata covers email confirmations opened on a
    // different device from the one that clicked the referral link.
    const metadataCode = data?.user?.user_metadata?.referral_code
    const claimCode = isValidReferralCode(referralCode)
      ? referralCode
      : typeof metadataCode === "string" && isValidReferralCode(metadataCode)
        ? metadataCode
        : null
    if (data?.user && claimCode) {
      await claimReferral(claimCode, data.user.id)
    }

    // Web Sign in with Apple: keep Apple's refresh token so deleting the
    // account can revoke it. The login page marks Apple redirects with
    // ?provider=apple because the session does not say which provider was
    // used for this sign-in.
    if (
      data?.user &&
      requestUrl.searchParams.get("provider") === "apple" &&
      data.session?.provider_refresh_token &&
      ((data.user.app_metadata?.providers as string[] | undefined) ?? []).includes("apple")
    ) {
      await storeAppleRefreshToken(data.user.id, data.session.provider_refresh_token)
    }

    // Send welcome email for new users (created within last 60 seconds)
    if (data?.user) {
      const createdAt = new Date(data.user.created_at).getTime()
      const now = Date.now()
      const isNewUser = now - createdAt < 60_000

      if (isNewUser) {
        const isOAuth = data.user.app_metadata?.provider !== "email"

        // The cookie is unsigned and therefore untrusted. Its validated,
        // length-limited values are analytics metadata only and never affect
        // authorization, billing, or product behavior. Existing accounts are
        // deliberately excluded so a later campaign click cannot rewrite
        // their acquisition source.
        if (firstTouch && !data.user.user_metadata?.first_touch_source) {
          const { error: attributionError } = await supabase.auth.updateUser({
            data: attributionUserMetadata(firstTouch),
          })
          if (attributionError) {
            console.error("Failed to persist signup attribution")
          }
        }

        if (isOAuth) {
          try {
            await track("signup_completed", {
              method: data.user.app_metadata?.provider || "oauth",
              ...attributionEventProperties(firstTouch),
            }, { request })
          } catch {
            // Analytics is non-critical and must never block authentication.
            console.error("Failed to track OAuth signup")
          }
        }

        try {
          await fetch(`${origin}/api/auth/welcome`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || "",
            },
            body: JSON.stringify({
              email: data.user.email,
              name: data.user.user_metadata?.full_name || null,
            }),
          })
        } catch {
          // Welcome email is non-critical, don't block redirect
          console.error("Failed to send welcome email")
        }

        // New email signups go to branded verify page (not OAuth)
        if (!isOAuth) {
          return withReferralCookieCleared(NextResponse.redirect(`${origin}/auth/verify`), hasReferralCookie)
        }
      }
    }
  }

  return withReferralCookieCleared(NextResponse.redirect(`${origin}/dashboard`), hasReferralCookie)
}
