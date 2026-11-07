import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { appleSignInEnabled } from "@/lib/apple/sign-in-flag"

// Regression: "Continue with Apple" shipped on the web login while the Apple
// provider was not enabled in Supabase Auth, so every tap failed.
describe("Sign in with Apple button flag", () => {
  it("is off unless explicitly enabled", () => {
    expect(appleSignInEnabled(undefined)).toBe(false)
    expect(appleSignInEnabled("")).toBe(false)
    expect(appleSignInEnabled("false")).toBe(false)
    expect(appleSignInEnabled("1")).toBe(false)
    expect(appleSignInEnabled("true")).toBe(true)
    expect(appleSignInEnabled(" TRUE ")).toBe(true)
  })

  it("gates the login page's Apple button", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/(auth)/login/page.tsx"), "utf8")
    const flag = source.indexOf("{appleSignInEnabled() && (")
    const button = source.indexOf("Continue with Apple")
    expect(flag).toBeGreaterThan(-1)
    expect(button).toBeGreaterThan(flag)
    expect(source.match(/Continue with Apple/g)).toHaveLength(1)
  })
})
