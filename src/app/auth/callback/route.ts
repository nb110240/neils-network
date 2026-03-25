import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Send welcome email for new users (created within last 60 seconds)
    if (data?.user) {
      const createdAt = new Date(data.user.created_at).getTime()
      const now = Date.now()
      const isNewUser = now - createdAt < 60_000

      if (isNewUser) {
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
        const isOAuth = data.user.app_metadata?.provider !== "email"
        if (!isOAuth) {
          return NextResponse.redirect(`${origin}/auth/verify`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
