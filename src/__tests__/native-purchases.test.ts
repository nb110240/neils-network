import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// purchases.ts picks the RevenueCat SDK key by Capacitor platform. Android must
// use the Play key, iOS the App Store key, and a platform with no key must fail
// closed without ever touching the SDK.

const rc = vi.hoisted(() => ({
  configure: vi.fn(async () => {}),
  setAttributes: vi.fn(async () => {}),
  getOfferings: vi.fn(async () => ({
    current: {
      availablePackages: [
        { packageType: "MONTHLY", identifier: "$rc_monthly" },
        { packageType: "ANNUAL", identifier: "$rc_annual" },
      ],
    },
  })),
  purchasePackage: vi.fn(async () => ({
    customerInfo: { entitlements: { active: { pro: {} } } },
  })),
  restorePurchases: vi.fn(async () => ({
    customerInfo: { entitlements: { active: { pro: {} } } },
  })),
}))

const browser = vi.hoisted(() => ({ open: vi.fn(async () => {}) }))
vi.mock("@capacitor/browser", () => ({ Browser: browser }))

vi.mock("@revenuecat/purchases-capacitor", () => ({
  Purchases: rc,
  PACKAGE_TYPE: { MONTHLY: "MONTHLY", ANNUAL: "ANNUAL" },
}))

const USER = "11111111-1111-4111-8111-111111111111"

function setPlatform(platform: "ios" | "android" | "web") {
  vi.stubGlobal("window", {
    Capacitor: {
      isNativePlatform: () => platform !== "web",
      getPlatform: () => platform,
    },
  })
}

async function load(keys: { ios?: string; android?: string }) {
  vi.stubEnv("NEXT_PUBLIC_REVENUECAT_IOS_KEY", keys.ios ?? "")
  vi.stubEnv("NEXT_PUBLIC_REVENUECAT_ANDROID_KEY", keys.android ?? "")
  vi.resetModules()
  return import("@/lib/native/purchases")
}

describe("native purchases platform keys", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ sig: "signed" }), { status: 200 })),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("revenueCatKeyFor maps only ios and android", async () => {
    const { revenueCatKeyFor } = await load({})
    const keys = { ios: "appl_x", android: "goog_x" }
    expect(revenueCatKeyFor("ios", keys)).toBe("appl_x")
    expect(revenueCatKeyFor("android", keys)).toBe("goog_x")
    expect(revenueCatKeyFor("web", keys)).toBeUndefined()
    expect(revenueCatKeyFor("android", { ios: "appl_x" })).toBeUndefined()
    expect(revenueCatKeyFor("ios", { android: "goog_x" })).toBeUndefined()
  })

  it("Android configures RevenueCat with the Play key and buys the annual plan", async () => {
    setPlatform("android")
    const { configurePurchases, purchasePro } = await load({ ios: "appl_x", android: "goog_x" })
    await configurePurchases(USER)
    expect(rc.configure).toHaveBeenCalledWith({ apiKey: "goog_x", appUserID: USER })
    expect(rc.setAttributes).toHaveBeenCalledWith({ savvo_sig: "signed" })

    const result = await purchasePro("yearly")
    expect(result).toEqual({ ok: true })
    expect(rc.purchasePackage).toHaveBeenCalledWith({
      aPackage: { packageType: "ANNUAL", identifier: "$rc_annual" },
    })
  })

  it("iOS still configures RevenueCat with the iOS key", async () => {
    setPlatform("ios")
    const { configurePurchases } = await load({ ios: "appl_x", android: "goog_x" })
    await configurePurchases(USER)
    expect(rc.configure).toHaveBeenCalledWith({ apiKey: "appl_x", appUserID: USER })
  })

  it("Android without its own key fails closed and never borrows the iOS key", async () => {
    setPlatform("android")
    const { configurePurchases, purchasePro } = await load({ ios: "appl_x" })
    await configurePurchases(USER)
    expect(rc.configure).not.toHaveBeenCalled()
    expect(await purchasePro("monthly")).toEqual({
      ok: false,
      error: "Purchases are not configured",
    })
    expect(rc.purchasePackage).not.toHaveBeenCalled()
  })

  it("iOS without its key fails closed (unchanged behavior)", async () => {
    setPlatform("ios")
    const { purchasePro } = await load({ android: "goog_x" })
    expect(await purchasePro("monthly")).toEqual({
      ok: false,
      error: "Purchases are not configured",
    })
  })

  it("web is a no-op", async () => {
    setPlatform("web")
    const { purchasePro } = await load({ ios: "appl_x", android: "goog_x" })
    expect(await purchasePro("monthly")).toEqual({ ok: false, error: "not native" })
    expect(rc.configure).not.toHaveBeenCalled()
  })
})

describe("store subscription management", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("sends each platform's subscribers to their own store", async () => {
    const { storeSubscriptionsUrl } = await load({ ios: "appl_x", android: "goog_x" })
    expect(storeSubscriptionsUrl("ios")).toBe("https://apps.apple.com/account/subscriptions")
    expect(storeSubscriptionsUrl("android")).toBe("https://play.google.com/store/account/subscriptions?package=app.savvo")
    expect(storeSubscriptionsUrl("web")).toBeNull()
  })

  it("opens the Play subscription screen on Android and nothing on the web", async () => {
    browser.open.mockClear()
    setPlatform("android")
    const android = await load({ android: "goog_x" })
    await android.openStoreSubscriptions()
    expect(browser.open).toHaveBeenCalledWith({ url: "https://play.google.com/store/account/subscriptions?package=app.savvo" })

    browser.open.mockClear()
    setPlatform("web")
    const web = await load({})
    await web.openStoreSubscriptions()
    expect(browser.open).not.toHaveBeenCalled()
  })

  it("restores an active Pro entitlement", async () => {
    setPlatform("ios")
    const { restorePurchases } = await load({ ios: "appl_x" })
    await expect(restorePurchases()).resolves.toEqual({ ok: true })
    rc.restorePurchases.mockResolvedValueOnce({ customerInfo: { entitlements: { active: {} } } } as never)
    await expect(restorePurchases()).resolves.toEqual({ ok: false })
  })
})
