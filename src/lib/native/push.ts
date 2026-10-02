"use client"

import { isNative } from "./capacitor"

// Native push notifications (iOS APNs, Android FCM) via
// @capacitor/push-notifications. Every function is a no-op on the web.
//
// Flow: the plugin hands us a device token after register(); we post it to
// /api/native/push-token for the signed-in user and remember it locally so
// sign-out can tell the server to forget this device.

export type PushPermission = "granted" | "denied" | "prompt" | "unsupported"

const TOKEN_KEY = "savvo:push-token"
const PROMPT_DISMISSED_KEY = "savvo:push-prompt-dismissed-at"
/** After "Not now", ask again no sooner than this. */
export const PROMPT_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

type PushPlugin = typeof import("@capacitor/push-notifications").PushNotifications

// Capacitor plugins are Proxies that answer every property, `then`
// included, so they look like promises. Returning one straight from an async
// function makes the caller await it forever: always wrap it.
async function plugin(): Promise<{ push: PushPlugin } | null> {
  if (!isNative()) return null
  try {
    return { push: (await import("@capacitor/push-notifications")).PushNotifications }
  } catch {
    return null
  }
}

function platform(): "ios" | "android" | null {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  const name = cap?.getPlatform?.()
  return name === "ios" || name === "android" ? name : null
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

/** Only same-origin app paths are opened from a notification. */
export function safeNotificationPath(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return null
  return url
}

export async function getPushPermission(): Promise<PushPermission> {
  const push = (await plugin())?.push
  if (!push) return "unsupported"
  try {
    const { receive } = await push.checkPermissions()
    if (receive === "granted" || receive === "denied") return receive
    return "prompt"
  } catch {
    return "unsupported"
  }
}

let listenersReady: Promise<void> | null = null

/**
 * register() must never run before the "registration" listener exists: iOS
 * answers from its token cache almost immediately, and an event fired with
 * no listener is lost, leaving the device unregistered.
 */
async function afterListeners() {
  if (listenersReady) await listenersReady
}

/**
 * Wires the plugin listeners once: token registration and notification taps.
 * `navigate` receives a same-origin path.
 */
export function initPushListeners(navigate: (path: string) => void): Promise<void> {
  if (listenersReady) return listenersReady
  listenersReady = (async () => {
    const push = (await plugin())?.push
    const os = platform()
    if (!push || !os) return
    await push.addListener("registration", (token) => {
      void saveToken(token.value, os)
    })
    await push.addListener("registrationError", () => {
      // Usually a missing entitlement or no network. Nothing to show.
    })
    await push.addListener("pushNotificationActionPerformed", (action) => {
      const path = safeNotificationPath((action.notification.data as { url?: unknown } | undefined)?.url)
      if (path) navigate(path)
    })
  })().catch(() => {
    listenersReady = null
  })
  return listenersReady
}

async function saveToken(token: string, os: "ios" | "android") {
  try {
    const res = await fetch("/api/native/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token, platform: os }),
    })
    if (res.ok) storage()?.setItem(TOKEN_KEY, token)
  } catch {
    // Retried on the next launch, when registration runs again.
  }
}

/** Asks for permission (system dialog) and registers if granted. */
export async function enablePush(): Promise<PushPermission> {
  const push = (await plugin())?.push
  if (!push) return "unsupported"
  try {
    const { receive } = await push.requestPermissions()
    if (receive !== "granted") return receive === "denied" ? "denied" : "prompt"
    await afterListeners()
    await push.register()
    return "granted"
  } catch {
    return "unsupported"
  }
}

/**
 * On launch or sign-in: if permission was already granted, register again.
 * Tokens can rotate, and this re-links the device to whoever is signed in.
 */
export async function refreshPushRegistration(): Promise<void> {
  const push = (await plugin())?.push
  if (!push) return
  try {
    const { receive } = await push.checkPermissions()
    if (receive !== "granted") return
    await afterListeners()
    await push.register()
  } catch {
    // Non-critical.
  }
}

/** On sign-out: stop this device receiving the previous account's alerts. */
export async function forgetPushToken(): Promise<void> {
  const store = storage()
  const token = store?.getItem(TOKEN_KEY)
  if (!token) return
  try {
    const res = await fetch("/api/native/push-token", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token }),
    })
    if (res.ok) store?.removeItem(TOKEN_KEY)
  } catch {
    // Keep the token so the next sign-out or sign-in can retry; a sign-in
    // re-registers the device to the new account either way.
  }
}

export function pushPromptDismissedRecently(now = Date.now()): boolean {
  const raw = storage()?.getItem(PROMPT_DISMISSED_KEY)
  const at = raw ? Number(raw) : NaN
  return Number.isFinite(at) && now - at < PROMPT_SNOOZE_MS
}

export function dismissPushPrompt(now = Date.now()) {
  try {
    storage()?.setItem(PROMPT_DISMISSED_KEY, String(now))
  } catch {
    // Storage blocked: the prompt may come back next launch, which is fine.
  }
}
