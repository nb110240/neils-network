"use client"

/**
 * Native Google sign-in via the system browser.
 *
 * Google blocks OAuth inside embedded WebViews ("disallowed_useragent"), so the
 * in-app Capacitor WebView cannot run the normal supabase.auth.signInWithOAuth
 * redirect. Instead we ask Supabase for the provider URL (skipBrowserRedirect),
 * open it in the system browser (ASWebAuthenticationSession via @capacitor/browser),
 * and catch the OAuth redirect back into the app as a custom-scheme deep link,
 * then exchange the PKCE code for a session.
 *
 * No-op on web: callers should use the normal Supabase web OAuth there.
 *
 * Setup (see ios/DEPLOY-IOS.md):
 *  - Register the URL scheme "app.savvo" in the iOS project (CFBundleURLTypes).
 *  - Add NATIVE_OAUTH_REDIRECT to the Supabase Auth "Redirect URLs" allowlist.
 */

import { createClient } from "@/lib/supabase/client"
import { isNative } from "./capacitor"

const NATIVE_OAUTH_REDIRECT = "app.savvo://auth/callback"

type AuthResult = { ok: boolean; error?: string }

/** Exact match on the OAuth callback deep link (not a prefix). */
function isCallbackUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return (
      u.protocol === "app.savvo:" &&
      u.host === "auth" &&
      u.pathname === "/callback"
    )
  } catch {
    return false
  }
}

export async function signInWithGoogleNative(): Promise<AuthResult> {
  if (!isNative()) return { ok: false, error: "not native" }

  const supabase = createClient()
  const { App } = await import("@capacitor/app")
  const { Browser } = await import("@capacitor/browser")

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true },
  })
  if (error || !data?.url) {
    return { ok: false, error: error?.message ?? "Could not start Google sign-in" }
  }

  return new Promise<AuthResult>((resolve) => {
    let settled = false
    let removeUrl: () => void = () => {}
    let removeFinished: () => void = () => {}
    let cancelTimer: ReturnType<typeof setTimeout> | null = null

    const settle = (result: AuthResult) => {
      if (settled) return
      settled = true
      if (cancelTimer) clearTimeout(cancelTimer)
      removeUrl()
      removeFinished()
      resolve(result)
    }

    const onUrl = (event: { url: string }) => {
      if (!isCallbackUrl(event.url)) return
      void (async () => {
        try {
          await Browser.close()
        } catch {
          /* browser may already be dismissed */
        }
        try {
          const code = new URL(event.url).searchParams.get("code")
          if (!code) {
            settle({ ok: false, error: "No authorization code returned" })
            return
          }
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code)
          settle(exErr ? { ok: false, error: exErr.message } : { ok: true })
        } catch (e) {
          settle({ ok: false, error: e instanceof Error ? e.message : "Sign-in failed" })
        }
      })()
    }

    const onFinished = () => {
      // The OAuth redirect both closes the system browser AND delivers
      // appUrlOpen, and the order is not guaranteed. Give the deep link a
      // moment to arrive before treating a dismissed browser as a cancel.
      if (settled || cancelTimer) return
      cancelTimer = setTimeout(() => settle({ ok: false, error: "cancelled" }), 1200)
    }

    Promise.all([
      App.addListener("appUrlOpen", onUrl),
      Browser.addListener("browserFinished", onFinished),
    ])
      .then(([urlHandle, finishedHandle]) => {
        removeUrl = () => void urlHandle.remove()
        removeFinished = () => void finishedHandle.remove()
        if (settled) {
          removeUrl()
          removeFinished()
          return
        }
        Browser.open({ url: data.url }).catch((e) => {
          settle({
            ok: false,
            error: e instanceof Error ? e.message : "Could not open browser",
          })
        })
      })
      .catch((e) => {
        settle({
          ok: false,
          error: e instanceof Error ? e.message : "Sign-in could not start",
        })
      })
  })
}
