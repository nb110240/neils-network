import { NextResponse } from "next/server"
import { authenticateRequest, authFailed } from "@/lib/api-utils"
import { signSubscriberAttribute } from "@/lib/revenuecat"

/**
 * Returns an HMAC of the caller's Supabase user id, signed with the server
 * secret, for the native client to set as the RevenueCat `savvo_sig` subscriber
 * attribute. The webhook recomputes and verifies it so app_user_id alone cannot
 * grant Pro.
 *
 * Requires a valid session (authenticateRequest). When attribute verification
 * is disabled (no secret), signSubscriberAttribute returns null and we return
 * { sig: null } — the client simply skips setting the attribute.
 */
export async function GET() {
  const auth = await authenticateRequest("general")
  if (authFailed(auth)) return auth.error
  const { user } = auth

  return NextResponse.json({ sig: signSubscriberAttribute(user.id) })
}
