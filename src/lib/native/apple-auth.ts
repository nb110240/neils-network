"use client"

/**
 * Sign in with Apple inside the native app.
 *
 * iOS: the native Apple sheet (ASAuthorizationController via
 * @capacitor-community/apple-sign-in). Apple's identity token goes to
 * Supabase with signInWithIdToken. Supabase checks the nonce: Apple receives
 * the SHA-256 of a random value, Supabase receives the raw value.
 *
 * Android: no native Apple UI exists, so it uses the same system-browser
 * OAuth flow as Google.
 *
 * Either way the app then hands Apple's token to /api/native/apple-token so
 * deleting the account can revoke it.
 *
 * Setup (see ios/DEPLOY-IOS.md): enable the Sign in with Apple capability in
 * Xcode, and add the bundle id app.savvo to the Supabase Apple provider's
 * Client IDs alongside the web Services ID.
 */

import { createClient } from "@/lib/supabase/client"
import { isNative } from "./capacitor"
import { signInWithOAuthNative } from "./google-auth"

type AuthResult = { ok: boolean; error?: string }

const BUNDLE_ID = "app.savvo"
const WEB_REDIRECT = "https://savvo.app/auth/callback"

function platform(): string | undefined {
  return (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.()
}

function randomNonce(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

/** The plugin rejects with code 1001 (ASAuthorizationError.canceled) when the sheet is dismissed. */
export function isAppleCancel(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null
  const text = `${e?.code ?? ""} ${e?.message ?? ""}`
  return /1001|cancel/i.test(text)
}

function sendTokenToServer(body: { authorizationCode: string } | { refreshToken: string }) {
  // Sign-in has already succeeded; this only enables revocation later.
  void fetch("/api/native/apple-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  }).catch(() => {})
}

export async function signInWithAppleNative(): Promise<AuthResult> {
  if (!isNative()) return { ok: false, error: "not native" }

  if (platform() !== "ios") {
    const result = await signInWithOAuthNative("apple")
    if (result.ok) {
      const { data } = await createClient().auth.getSession()
      const refreshToken = data.session?.provider_refresh_token
      if (refreshToken) sendTokenToServer({ refreshToken })
    }
    return result
  }

  try {
    const { SignInWithApple } = await import("@capacitor-community/apple-sign-in")
    const rawNonce = randomNonce()
    const { response } = await SignInWithApple.authorize({
      clientId: BUNDLE_ID,
      redirectURI: WEB_REDIRECT,
      scopes: "email name",
      nonce: await sha256Hex(rawNonce),
    })
    if (!response?.identityToken) return { ok: false, error: "Apple did not return an identity token" }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: response.identityToken,
      nonce: rawNonce,
    })
    if (error) return { ok: false, error: error.message }

    // Apple shares the name only the first time someone signs in, and the
    // identity token never carries it. Save it so emails can greet them.
    const fullName = [response.givenName, response.familyName].filter(Boolean).join(" ").trim()
    if (fullName && !data.user?.user_metadata?.full_name) {
      await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {})
    }
    if (response.authorizationCode) sendTokenToServer({ authorizationCode: response.authorizationCode })
    return { ok: true }
  } catch (error) {
    if (isAppleCancel(error)) return { ok: false, error: "cancelled" }
    return { ok: false, error: error instanceof Error ? error.message : "Apple sign-in failed" }
  }
}
