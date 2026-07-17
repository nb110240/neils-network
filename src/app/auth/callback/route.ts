import { track } from "@vercel/analytics/server"
import { createClient } from "@/lib/supabase/server"
import {
  attributionEventProperties,
  attributionFromCookieHeader,
  attributionUserMetadata,
} from "@/lib/attribution"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin
  const firstTouch = attributionFromCookieHeader(request.headers.get("cookie"))

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

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
          return NextResponse.redirect(`${origin}/auth/verify`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
