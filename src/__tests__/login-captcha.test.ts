import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const loginSource = readFileSync(
  join(process.cwd(), "src/app/(auth)/login/page.tsx"),
  "utf8"
)

describe("email auth CAPTCHA wiring", () => {
  it("passes a configured token to sign up", () => {
    expect(loginSource).toMatch(
      /signUp\(\{[\s\S]*?options:\s*\{[\s\S]*?\.\.\.\(captchaToken \? \{ captchaToken \} : \{\}\),[\s\S]*?\}\s*,?\s*\}\)/
    )
  })

  it("passes a configured token to password sign-in", () => {
    expect(loginSource).toMatch(
      /signInWithPassword\(\{[\s\S]*?\.\.\.\(captchaToken \? \{ options: \{ captchaToken \} \} : \{\}\),[\s\S]*?\}\)/
    )
  })

  it("passes a configured token to password reset", () => {
    expect(loginSource).toMatch(
      /resetPasswordForEmail\(email,\s*\{[\s\S]*?\.\.\.\(captchaToken \? \{ captchaToken \} : \{\}\),[\s\S]*?\}\)/
    )
  })

  it("passes a fresh configured token when resending verification", () => {
    expect(loginSource).toMatch(
      /resend\(\{[\s\S]*?type:\s*"signup"[\s\S]*?\.\.\.\(captchaToken \? \{ options: \{ captchaToken \} \} : \{\}\),[\s\S]*?\}\)/
    )
    expect(loginSource).toContain("!!TURNSTILE_SITE_KEY && !captchaToken")
  })
})
