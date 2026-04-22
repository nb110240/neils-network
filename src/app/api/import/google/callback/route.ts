import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/import?google=error`)
  }

  // CSRF verification: check state matches what we set in the cookie
  const cookieStore = await cookies()
  const storedState = cookieStore.get("google_import_state")?.value
  cookieStore.delete("google_import_state")

  if (!state || !storedState || state !== storedState) {
    console.error("Google import callback: state mismatch (CSRF protection)")
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

    // Store the access token in a secure httpOnly cookie bound to this user
    const response = NextResponse.redirect(`${appUrl}/import?google=ready`)
    response.cookies.set("google_import_token", JSON.stringify({ token: tokens.access_token, userId: user.id }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 300, // 5 minutes — token is short-lived
    })

    return response
  } catch (err) {
    console.error("Google import callback error:", err)
    return NextResponse.redirect(`${appUrl}/import?google=error`)
  }
}
