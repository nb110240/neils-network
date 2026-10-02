"use client"

/**
 * Guarded Capacitor native helpers.
 *
 * This module is safe to import anywhere, including in code that runs during
 * SSR: nothing from @capacitor/* is imported at module load. Every export
 * either early-returns on web or dynamically imports the plugin only after a
 * runtime `isNative()` check. On the web (normal browser / Next.js server)
 * these functions are no-ops, so web behavior is never affected and the
 * `next build` stays green.
 *
 * The app uses the Capacitor server.url model — the iOS WebView loads the
 * hosted https://savvo.app, so this same client bundle ships to both web and
 * native; the guards are what keep the two paths separate at runtime.
 */

/**
 * True only when running inside a Capacitor native shell (iOS/Android).
 * Returns false during SSR and in any normal browser. Synchronous and cheap.
 */
export function isNative(): boolean {
  if (typeof window === "undefined") return false
  // Capacitor injects a global object into the native WebView.
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return Boolean(cap?.isNativePlatform?.())
}

/**
 * One-time native initialization. Sets the status bar style and wires an
 * app-URL-open listener so deep links / universal links navigate the WebView.
 * No-op on web. Guarded so repeated calls (React StrictMode double-mount, HMR,
 * a remount) never stack duplicate listeners.
 */
let nativeInitialized = false

export async function initNative(): Promise<void> {
  if (!isNative() || nativeInitialized) return
  nativeInitialized = true

  // Opt into edge-to-edge so iOS exposes non-zero env(safe-area-inset-*) values
  // (otherwise the safe-area CSS in globals.css is inert). Native only — the web
  // viewport is never touched, so mobile-web layout is unchanged.
  try {
    const viewport = document.querySelector('meta[name="viewport"]')
    const content = viewport?.getAttribute("content") ?? ""
    if (viewport && !content.includes("viewport-fit")) {
      viewport.setAttribute("content", `${content}, viewport-fit=cover`)
    }
  } catch {
    // Non-critical.
  }

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar")
    // Default (light content background) status bar; matches the light-mode
    // sand theme. Dark mode is handled by the WebView content itself.
    await StatusBar.setStyle({ style: Style.Default })
  } catch {
    // Status bar plugin unavailable — non-critical.
  }

  try {
    const { App } = await import("@capacitor/app")
    // When the OS opens the app via a savvo.app universal link, navigate the
    // in-app WebView to the matching path rather than bouncing to Safari.
    App.addListener("appUrlOpen", (event: { url: string }) => {
      try {
        const url = new URL(event.url)
        // Exact host match (or a true subdomain). A bare
        // endsWith("savvo.app") would also trust attacker-registrable
        // siblings like "evilsavvo.app" and let a crafted universal link
        // drive authenticated in-app navigation.
        const host = url.hostname
        if (
          url.protocol === "https:" &&
          (host === "savvo.app" || host.endsWith(".savvo.app"))
        ) {
          // Navigate to an absolute SAME-ORIGIN target. A protocol-relative
          // pathname like "//evil.example/x" (from a link such as
          // https://savvo.app//evil.example/x) would otherwise be assigned
          // verbatim and the WebView would treat "//evil.example" as a
          // cross-origin host. Reject "//" paths and always prefix our origin.
          const path = url.pathname.startsWith("//") ? "/" : url.pathname
          window.location.assign(
            window.location.origin + path + url.search + url.hash,
          )
        }
      } catch {
        // Malformed URL — ignore.
      }
    })
  } catch {
    // App plugin unavailable — non-critical.
  }
}

/**
 * Opens the native share sheet with the given contact text. Falls back to a
 * no-op on web (callers should use the existing web flow there).
 */
export async function shareContact(text: string): Promise<void> {
  if (!isNative()) return

  try {
    const { Share } = await import("@capacitor/share")
    await Share.share({ text })
  } catch {
    // Share plugin unavailable or user cancelled — non-critical.
  }
}
