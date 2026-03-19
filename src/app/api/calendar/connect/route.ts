import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { authenticateRequest, authFailed, errorResponse, badRequestResponse, forbiddenResponse } from "@/lib/api-utils"
import { getUserPlan, getPlanLimits } from "@/lib/subscription"
import { createHmac } from "crypto"

// Sign state to prevent IDOR — attacker can't forge a valid state for another user
function getOAuthStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET
  if (!secret) throw new Error("Missing OAUTH_STATE_SECRET — cannot sign OAuth state")
  return secret
}

function signState(userId: string): string {
  const sig = createHmac("sha256", getOAuthStateSecret()).update(userId).digest("hex").slice(0, 16)
  return `${userId}.${sig}`
}

export function verifyState(state: string): string | null {
  const [userId, sig] = state.split(".")
  if (!userId || !sig) return null
  const expected = createHmac("sha256", getOAuthStateSecret()).update(userId).digest("hex").slice(0, 16)
  if (sig !== expected) return null
  return userId
}

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
    authUrl.searchParams.set("state", signState(user.id))

    return NextResponse.json({ url: authUrl.toString() })
  } catch (error) {
    console.error("Calendar connect error:", error)
    return errorResponse("Internal server error")
  }
}

// POST: Exchange code for tokens (internal use only)
export async function POST(request: Request) {
  try {
    // Verify the caller is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { code, state: userId } = await request.json()

    if (!code || !userId) {
      return badRequestResponse("Missing code or state")
    }

    // Validate userId matches authenticated user (prevent IDOR)
    if (user && userId !== user.id) {
      return forbiddenResponse()
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/connect/callback`,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error("Token exchange failed:", err)
      return errorResponse("Failed to exchange code")
    }

    const tokens = await tokenRes.json()

    const serviceSupabase = await createServiceClient()
    await serviceSupabase.from("integrations").upsert(
      {
        user_id: userId,
        provider: "google_calendar",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
      { onConflict: "user_id,provider" }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Calendar token exchange error:", error)
    return errorResponse("Internal server error")
  }
}
