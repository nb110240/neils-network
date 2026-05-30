import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { log } from "@/lib/logger"

/**
 * RevenueCat webhook -> Pro entitlement sync.
 *
 * RevenueCat is the source of truth for iOS IAP. It POSTs subscription events
 * here; we mirror them into the same `subscriptions` table the Stripe webhook
 * writes, so the rest of the app reads one Pro signal regardless of platform.
 *
 * RevenueCat is configured (in code) with appUserID = the Supabase user id, so
 * event.app_user_id maps to subscriptions.user_id.
 *
 * Trust model / known limitation: app_user_id is set by the native client using
 * the PUBLIC RevenueCat SDK key, so a modified client could configure an
 * arbitrary Supabase UUID. The strong, secret Authorization header below is the
 * real guard against forged grants, and we additionally require the purchase to
 * actually carry the "pro" entitlement. For defense in depth before scaling,
 * harden by setting a server-minted signed subscriber attribute at configure
 * time and verifying it here (or verifying the subscriber via the RevenueCat
 * REST API) so app_user_id alone is never sufficient to grant Pro.
 */

const PRO_ENTITLEMENT = "pro"

function authorized(header: string | null): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH
  if (!expected || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch; check length first (the length
  // itself is not secret).
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    event?: {
      type?: string
      app_user_id?: string
      expiration_at_ms?: number
      entitlement_ids?: string[] | null
    }
  } | null
  const event = body?.event
  if (!event?.type || !event.app_user_id) {
    return NextResponse.json({ message: "Bad payload" }, { status: 400 })
  }

  const userId = event.app_user_id
  const type = event.type
  // Only treat events that actually carry the "pro" entitlement as Pro grants,
  // so unrelated/future products can never flip a user to Pro.
  const grantsPro =
    Array.isArray(event.entitlement_ids) &&
    event.entitlement_ids.includes(PRO_ENTITLEMENT)
  const currentPeriodEnd = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null

  const supabase = await createServiceClient()

  // ACTIVATE keeps/grants Pro. CANCELLATION is intentionally absent (auto-renew
  // off, still entitled until expiry). Only EXPIRATION downgrades; BILLING_ISSUE
  // has a grace period and must NOT immediately revoke.
  const ACTIVATE = [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "UNCANCELLATION",
    "NON_RENEWING_PURCHASE",
  ]
  const DEACTIVATE = ["EXPIRATION"]

  let dbError: { message: string } | null = null

  if (ACTIVATE.includes(type) && grantsPro) {
    const { error } = await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        plan: "pro",
        status: "active",
        current_period_end: currentPeriodEnd,
      },
      { onConflict: "user_id" },
    )
    dbError = error
  } else if (DEACTIVATE.includes(type)) {
    // Guard against a stale/out-of-order expiration overwriting a newer
    // renewal: only downgrade if this event is not older than what we have.
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", userId)
      .maybeSingle()
    const stored = existing?.current_period_end
      ? Date.parse(existing.current_period_end)
      : 0
    const incoming = currentPeriodEnd ? Date.parse(currentPeriodEnd) : 0
    if (incoming >= stored) {
      const { error } = await supabase
        .from("subscriptions")
        .update({ plan: "free", status: "canceled" })
        .eq("user_id", userId)
      dbError = error
    }
  }

  if (dbError) {
    // Return 5xx so RevenueCat retries rather than silently dropping the grant.
    log("error", "RevenueCat webhook DB write failed", {
      action: "revenuecat.webhook",
      route: "/api/native/revenuecat-webhook",
      eventType: type,
      error: dbError.message,
    })
    return NextResponse.json({ message: "Write failed" }, { status: 500 })
  }

  log("info", "RevenueCat webhook processed", {
    action: "revenuecat.webhook",
    route: "/api/native/revenuecat-webhook",
    eventType: type,
    userId,
    grantsPro,
  })
  return NextResponse.json({ received: true })
}
