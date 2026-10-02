import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { log } from "@/lib/logger"
import {
  attributeVerificationEnabled,
  verifySubscriberAttribute,
} from "@/lib/revenuecat"
import { isValidUUID } from "@/lib/api-utils"

/**
 * RevenueCat webhook -> Pro entitlement sync.
 *
 * RevenueCat is the source of truth for native in-app purchases on both iOS
 * (event.store "APP_STORE") and Android (event.store "PLAY_STORE"). It POSTs
 * subscription events here; we mirror them into the same `subscriptions` table
 * the Stripe webhook writes, so the rest of the app reads one Pro signal
 * regardless of platform. Event handling is deliberately store-agnostic: the
 * same event types, entitlement check, and signature check apply to every
 * store, so a Play purchase grants and expires Pro exactly like an App Store one.
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

/**
 * Whether an extension's new expiration is later than the stored period end,
 * i.e. it really extends the subscription. `error` when the lookup failed.
 */
async function extendsStoredPeriod(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  currentPeriodEnd: string | null,
): Promise<{ extends: boolean; error: { message: string } | null }> {
  const incoming = currentPeriodEnd ? Date.parse(currentPeriodEnd) : NaN
  if (!Number.isFinite(incoming)) return { extends: false, error: null }
  const { data: existing, error } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) return { extends: false, error }
  const stored = existing?.current_period_end ? Date.parse(existing.current_period_end) : 0
  return { extends: incoming > stored, error: null }
}

export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    event?: {
      type?: string
      store?: string
      app_user_id?: string
      expiration_at_ms?: number
      entitlement_ids?: string[] | null
      subscriber_attributes?: Record<string, { value?: string }> | null
    }
  } | null
  const event = body?.event
  // app_user_id is used as the DB key and HMAC input; require a well-formed
  // UUID (it should equal a Supabase user id) before any crypto/DB work.
  if (
    !event?.type ||
    typeof event.app_user_id !== "string" ||
    !isValidUUID(event.app_user_id)
  ) {
    return NextResponse.json({ message: "Bad payload" }, { status: 400 })
  }

  const userId = event.app_user_id
  const type = event.type
  // Logged only (e.g. "APP_STORE", "PLAY_STORE"); never used to branch.
  const store = typeof event.store === "string" ? event.store : undefined

  // Defense in depth: app_user_id is set by the native client with the PUBLIC
  // SDK key, so by itself it is not authoritative. When a server secret is
  // configured, require a valid server-minted signed subscriber attribute that
  // only a session legitimately holding this account could have produced.
  // If verification is not enabled, proceed as before (documented degradation).
  if (attributeVerificationEnabled()) {
    const sig = event.subscriber_attributes?.savvo_sig?.value
    if (!verifySubscriberAttribute(userId, sig)) {
      // Missing or invalid signature. The client sets savvo_sig BEFORE a
      // purchase can proceed (see configurePurchases), so a legitimate purchase
      // event always carries a valid one — anything else is a forgery, a wrong
      // account, or a misconfigured client. Ack (200) WITHOUT granting. We do
      // NOT 425/retry: RevenueCat replays the same snapshot payload, so a
      // missing attribute would never appear on retry and would loop forever.
      log("warn", "RevenueCat webhook rejected: missing or invalid subscriber signature", {
        action: "revenuecat.webhook",
        route: "/api/native/revenuecat-webhook",
        eventType: type,
        store,
        userId,
      })
      return NextResponse.json({ received: true })
    }
  }
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
    // Expiration pushed out (App Store / Play deferral or extension): refresh
    // current_period_end so a later stale EXPIRATION cannot downgrade early.
    "SUBSCRIPTION_EXTENDED",
  ]
  const DEACTIVATE = ["EXPIRATION"]

  let dbError: { message: string } | null = null

  if (ACTIVATE.includes(type) && grantsPro) {
    if (!attributeVerificationEnabled() && process.env.NODE_ENV === "production") {
      // Fail closed: granting Pro in production WITHOUT the signing secret would
      // let the client-set app_user_id alone grant Pro. Do not grant, and log an
      // error so the missing REVENUECAT_ATTRIBUTE_SECRET is caught immediately.
      log("error", "RevenueCat grant blocked: REVENUECAT_ATTRIBUTE_SECRET unset in production", {
        action: "revenuecat.webhook",
        route: "/api/native/revenuecat-webhook",
        eventType: type,
        userId,
      })
    } else {
      // A retried or late extension that is no newer than what we have (for
      // example after an EXPIRATION or a later RENEWAL) must not reactivate
      // the subscription or pull its period end back.
      const extension = type === "SUBSCRIPTION_EXTENDED"
        ? await extendsStoredPeriod(supabase, userId, currentPeriodEnd)
        : null
      if (extension?.error) {
        dbError = extension.error
      } else if (extension && !extension.extends) {
        log("info", "RevenueCat stale extension ignored", {
          action: "revenuecat.webhook",
          route: "/api/native/revenuecat-webhook",
          eventType: type,
          store,
          userId,
        })
      } else {
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
      }
    }
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
      store,
      error: dbError.message,
    })
    return NextResponse.json({ message: "Write failed" }, { status: 500 })
  }

  log("info", "RevenueCat webhook processed", {
    action: "revenuecat.webhook",
    route: "/api/native/revenuecat-webhook",
    eventType: type,
    store,
    userId,
    grantsPro,
  })
  return NextResponse.json({ received: true })
}
