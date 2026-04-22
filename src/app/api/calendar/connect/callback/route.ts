import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { verifyState } from "../route"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard?calendar=error`)
  }

  // Verify the HMAC-signed state to prevent IDOR attacks
  const userId = verifyState(state)
  if (!userId) {
    console.error("Calendar callback: invalid state signature")
    return NextResponse.redirect(`${appUrl}/dashboard?calendar=error`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/calendar/connect/callback`,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", await tokenRes.text())
      return NextResponse.redirect(`${appUrl}/dashboard?calendar=error`)
    }

    const tokens = await tokenRes.json()

    const supabase = await createServiceClient()
    await supabase.from("integrations").upsert(
      {
        user_id: userId,
        provider: "google_calendar",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
      { onConflict: "user_id,provider" }
    )

    return NextResponse.redirect(`${appUrl}/dashboard?calendar=connected`)
  } catch (err) {
    console.error("Calendar callback error:", err)
    return NextResponse.redirect(`${appUrl}/dashboard?calendar=error`)
  }
}
