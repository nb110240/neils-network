import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"
import { createServiceClient } from "@/lib/supabase/server"
import { appleBundleId, appleServicesId, exchangeAppleAuthorizationCode, isAppleSignInConfigured } from "@/lib/apple/sign-in"
import { log } from "@/lib/logger"

const ROUTE = "/api/native/apple-token"

// iOS (native sheet) sends the one-time authorization code; Android (system
// browser OAuth through Supabase) already holds Apple's refresh token in the
// session, issued to the web Services ID.
const BodySchema = z.union([
  z.object({ authorizationCode: z.string().trim().min(1).max(2048) }).strict(),
  z.object({ refreshToken: z.string().trim().min(1).max(4096) }).strict(),
])

/**
 * Called once after Sign in with Apple in the app. Keeps Apple's refresh
 * token so deleting the account can revoke it (App Review guideline
 * 5.1.1(v)). Sign-in already
 * succeeded by the time this runs, so failures are logged, not surfaced.
 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("auth")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    let body: unknown = null
    try {
      body = await request.json()
    } catch {
      body = null
    }
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return badRequestResponse("Invalid authorization code")

    // Only accounts that actually signed in with Apple keep an Apple token.
    const { data: { user: fullUser } } = await supabase.auth.getUser()
    const providers = (fullUser?.app_metadata?.providers as string[] | undefined) ?? []
    if (!providers.includes("apple")) return badRequestResponse("This account does not use Sign in with Apple")

    if (!isAppleSignInConfigured()) {
      log("warn", "Apple token not stored: Sign in with Apple keys are not configured", { action: "apple.token", route: ROUTE, userId: user.id })
      return NextResponse.json({ stored: false })
    }

    let clientId: string
    let refreshToken: string
    if ("authorizationCode" in parsed.data) {
      clientId = appleBundleId()
      refreshToken = await exchangeAppleAuthorizationCode(parsed.data.authorizationCode, clientId)
    } else {
      const servicesId = appleServicesId()
      if (!servicesId) {
        log("warn", "Apple token not stored: APPLE_SERVICES_ID is not set", { action: "apple.token", route: ROUTE, userId: user.id })
        return NextResponse.json({ stored: false })
      }
      clientId = servicesId
      refreshToken = parsed.data.refreshToken
    }
    const service = await createServiceClient()
    const { error } = await service.from("apple_sign_in_tokens").upsert(
      { user_id: user.id, client_id: clientId, refresh_token: refreshToken, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    if (error) {
      log("error", "Failed to store Apple token", { action: "apple.token", route: ROUTE, userId: user.id, error: error.message })
      return errorResponse("Could not finish Apple sign-in setup")
    }
    return NextResponse.json({ stored: true })
  } catch (error) {
    log("error", "Apple token exchange error", { action: "apple.token", route: ROUTE, error: error instanceof Error ? error.message : String(error) })
    return errorResponse("Could not finish Apple sign-in setup")
  }
}
