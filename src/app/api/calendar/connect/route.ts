import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse, forbiddenResponse } from "@/lib/api-utils"
import { getUserPlan, getPlanLimits } from "@/lib/subscription"
import { signCalendarOAuthState } from "@/lib/calendar-oauth-state"

// GET: Start OAuth flow — redirect to Google
export async function GET() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const plan = await getUserPlan(user.id)
    const limits = getPlanLimits(plan)
    if (!limits.canCalendarSync) {
      return forbiddenResponse("Calendar sync is a Pro feature. Upgrade to connect your calendar.")
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return errorResponse("Google OAuth not configured")
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/connect/callback`
    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ")

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", scopes)
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("state", signCalendarOAuthState(user.id))

    return NextResponse.json({ url: authUrl.toString() })
  } catch (error) {
    console.error("Calendar connect error:", error)
    return errorResponse("Internal server error")
  }
}
