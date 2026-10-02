"use client"

/**
 * RevenueCat In-App Purchase helpers (iOS + Android Pro tier).
 *
 * Apple Guideline 3.1.1 and Google Play's Payments policy both require digital
 * goods sold inside the native app to use the store's own billing, not Stripe.
 * On native we route the Pro upgrade through RevenueCat (which wraps StoreKit
 * on iOS and Google Play Billing on Android, handles receipt validation, and
 * syncs entitlements via its webhook). On web the app keeps using Stripe
 * Checkout untouched.
 *
 * Like the rest of src/lib/native, nothing from @revenuecat/* is imported at
 * module load: every function early-returns on web and dynamically imports the
 * SDK only after an isNative() check, so this is a no-op on web/SSR and never
 * breaks `next build`.
 *
 * Setup (see ios/DEPLOY-IOS.md and android/DEPLOY-ANDROID.md):
 *  - NEXT_PUBLIC_REVENUECAT_IOS_KEY = the RevenueCat public iOS SDK key.
 *  - NEXT_PUBLIC_REVENUECAT_ANDROID_KEY = the RevenueCat public Google Play SDK
 *    key. The key is chosen by Capacitor platform; a platform without its own
 *    key fails closed ("Purchases are not configured"), it never borrows the
 *    other store's key.
 *  - A RevenueCat entitlement with identifier "pro" attached to the App Store
 *    Connect and Google Play auto-renewable subscription products (monthly +
 *    annual).
 *  - RevenueCat appUserID is set to the Supabase user id so the webhook can map
 *    purchases back to the right account.
 */

import { isNative } from "./capacitor"

// Referenced literally so Next.js inlines them into the client bundle.
const RC_IOS_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY
const RC_ANDROID_KEY = process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY
const PRO_ENTITLEMENT = "pro"

/**
 * The RevenueCat public SDK key for a Capacitor platform, or undefined when
 * that platform has no key (callers then fail closed). Only "ios" and
 * "android" ever get a key.
 */
export function revenueCatKeyFor(
  platform: string,
  keys: { ios?: string; android?: string } = {
    ios: RC_IOS_KEY,
    android: RC_ANDROID_KEY,
  },
): string | undefined {
  if (platform === "ios") return keys.ios || undefined
  if (platform === "android") return keys.android || undefined
  return undefined
}

/** Capacitor.getPlatform() from the injected global ("web" when absent). */
function nativePlatform(): string {
  if (typeof window === "undefined") return "web"
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } })
    .Capacitor
  return cap?.getPlatform?.() ?? "web"
}

function apiKey(): string | undefined {
  return revenueCatKeyFor(nativePlatform())
}

let configuredFor: string | null = null

/** Configure RevenueCat once per signed-in user. No-op on web. */
export async function configurePurchases(appUserId: string): Promise<void> {
  const key = apiKey()
  if (!isNative() || !key || configuredFor === appUserId) return
  const { Purchases } = await import("@revenuecat/purchases-capacitor")
  await Purchases.configure({ apiKey: key, appUserID: appUserId })

  // Set a server-minted signed subscriber attribute BEFORE marking configured,
  // so a purchase can never proceed unsigned under enforcement (which would
  // take the user's money and then be denied by the webhook). If we cannot
  // obtain/set the signature, leave configuredFor unset and throw so the caller
  // blocks the purchase and the next attempt retries.
  const res = await fetch("/api/native/revenuecat-attribute")
  if (!res.ok) throw new Error("Could not prepare purchase. Please try again.")
  const { sig } = (await res.json()) as { sig: string | null }
  if (sig) await Purchases.setAttributes({ savvo_sig: sig })

  configuredFor = appUserId
}

type PurchaseResult = { ok: boolean; error?: string }

/**
 * Buy the Pro subscription via StoreKit (iOS) or Google Play Billing (Android). Returns ok=true once the "pro"
 * entitlement is active. error "cancelled" means the user dismissed the sheet
 * (callers should stay silent). No-op on web.
 */
export async function purchasePro(
  billing: "monthly" | "yearly",
): Promise<PurchaseResult> {
  if (!isNative()) return { ok: false, error: "not native" }
  if (!apiKey()) return { ok: false, error: "Purchases are not configured" }

  try {
    const { Purchases, PACKAGE_TYPE } = await import(
      "@revenuecat/purchases-capacitor"
    )
    const offerings = await Purchases.getOfferings()
    const current = offerings.current
    if (!current) return { ok: false, error: "No subscription offerings available" }

    const wanted =
      billing === "yearly" ? PACKAGE_TYPE.ANNUAL : PACKAGE_TYPE.MONTHLY
    const pkg = current.availablePackages.find((p) => p.packageType === wanted)
    if (!pkg) return { ok: false, error: `No ${billing} plan available` }

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
    return { ok: Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT]) }
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean; message?: string }
    if (err?.userCancelled) return { ok: false, error: "cancelled" }
    return { ok: false, error: err?.message ?? "Purchase failed" }
  }
}

/**
 * Restore previous purchases (App Store requirement; also restores Google Play
 * subscriptions on Android). No-op on web.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isNative()) return { ok: false, error: "not native" }
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor")
    const { customerInfo } = await Purchases.restorePurchases()
    return { ok: Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT]) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restore failed" }
  }
}
