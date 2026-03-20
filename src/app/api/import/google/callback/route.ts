import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/import?google=error`)
  }

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login`)
    }

    // Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/import/google/callback`,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenRes.ok) {
      console.error("Google import token exchange failed:", await tokenRes.text())
      return NextResponse.redirect(`${appUrl}/import?google=error`)
    }

    const tokens = await tokenRes.json()

    // Redirect to import page with access token as a short-lived query param
    // The import page will use this token to fetch and preview contacts
    return NextResponse.redirect(
      `${appUrl}/import?google=ready&token=${encodeURIComponent(tokens.access_token)}`
    )
  } catch (err) {
    console.error("Google import callback error:", err)
    return NextResponse.redirect(`${appUrl}/import?google=error`)
  }
}
