import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Android App Links + native OAuth deep link wiring. Both halves (the
// website's assetlinks.json and the app's AndroidManifest intent filters) must
// agree on the package and paths or autoVerify silently fails.

const root = path.resolve(__dirname, "../..")
const assetlinks = JSON.parse(
  readFileSync(path.join(root, "public/.well-known/assetlinks.json"), "utf8"),
) as Array<{
  relation: string[]
  target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] }
}>
const manifest = readFileSync(
  path.join(root, "android/app/src/main/AndroidManifest.xml"),
  "utf8",
)
const strings = readFileSync(
  path.join(root, "android/app/src/main/res/values/strings.xml"),
  "utf8",
)

describe("assetlinks.json", () => {
  it("delegates URL handling to the app.savvo Android package", () => {
    expect(assetlinks).toHaveLength(1)
    const [entry] = assetlinks
    expect(entry.relation).toContain("delegate_permission/common.handle_all_urls")
    expect(entry.target.namespace).toBe("android_app")
    expect(entry.target.package_name).toBe("app.savvo")
  })

  it("has exactly one fingerprint: a placeholder or a real SHA-256", () => {
    const fps = assetlinks[0].target.sha256_cert_fingerprints
    expect(fps).toHaveLength(1)
    const sha256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/
    expect(
      fps[0] === "REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT" || sha256.test(fps[0]),
    ).toBe(true)
  })
})

describe("AndroidManifest deep links", () => {
  it("registers the app.savvo://auth/callback scheme used by native Google sign-in", () => {
    expect(strings).toContain('<string name="custom_url_scheme">app.savvo</string>')
    expect(manifest).toContain('android:scheme="@string/custom_url_scheme"')
    expect(manifest).toMatch(/android:host="auth"\s+android:path="\/callback"/)
  })

  it("auto-verifies https://savvo.app/auth/* App Links", () => {
    expect(manifest).toContain('android:autoVerify="true"')
    expect(manifest).toContain('<data android:host="savvo.app" />')
    expect(manifest).toContain('<data android:pathPrefix="/auth/" />')
  })

  it("declares POST_NOTIFICATIONS for Android 13+ push", () => {
    expect(manifest).toContain("android.permission.POST_NOTIFICATIONS")
  })

  it("lets the WebView QR scanner use the camera without requiring camera hardware", () => {
    expect(manifest).toContain("android.permission.CAMERA")
    expect(manifest).toMatch(/android\.hardware\.camera"\s+android:required="false"/)
  })
})
