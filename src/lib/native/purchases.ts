"use client"

/**
 * RevenueCat In-App Purchase helpers (iOS Pro tier).
 *
 * Apple Guideline 3.1.1 requires digital goods sold inside the iOS app to use
 * In-App Purchase, not Stripe. On native we route the Pro upgrade through
 * RevenueCat (which wraps StoreKit + handles receipt validation and entitlement
 * sync via its webhook). On web the app keeps using Stripe Checkout untouched.
 *
 * Like the rest of src/lib/native, nothing from @revenuecat/* is imported at
 * module load: every function early-returns on web and dynamically imports the
 * SDK only after an isNative() check, so this is a no-op on web/SSR and never
 * breaks `next build`.
 *
 * Setup (see ios/DEPLOY-IOS.md):
 *  - NEXT_PUBLIC_REVENUECAT_IOS_KEY = the RevenueCat public iOS SDK key.
 *  - A RevenueCat entitlement with identifier "pro" attached to the App Store
 *    Connect auto-renewable subscription products (monthly + annual).
 *  - RevenueCat appUserID is set to the Supabase user id so the webhook can map
 *    purchases back to the right account.
 */

import { isNative } from "./capacitor"

const RC_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY
const PRO_ENTITLEMENT = "pro"

let configuredFor: string | null = null

/** Configure RevenueCat once per signed-in user. No-op on web. */
export async function configurePurchases(appUserId: string): Promise<void> {
  if (!isNative() || !RC_API_KEY || configuredFor === appUserId) return
  const { Purchases } = await import("@revenuecat/purchases-capacitor")
  await Purchases.configure({ apiKey: RC_API_KEY, appUserID: appUserId })
  configuredFor = appUserId
}

type PurchaseResult = { ok: boolean; error?: string }

/**
 * Buy the Pro subscription via StoreKit. Returns ok=true once the "pro"
 * entitlement is active. error "cancelled" means the user dismissed the sheet
 * (callers should stay silent). No-op on web.
 */
export async function purchasePro(
  billing: "monthly" | "yearly",
): Promise<PurchaseResult> {
  if (!isNative()) return { ok: false, error: "not native" }
  if (!RC_API_KEY) return { ok: false, error: "Purchases are not configured" }

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

/** Restore previous purchases (App Store requirement). No-op on web. */
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
