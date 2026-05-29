import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor config for the Savvo iOS wrapper.
 *
 * WHY server.url (not a static export):
 * Savvo is a server-rendered Next.js app — server actions, API routes under
 * src/app/api, Supabase SSR, and Sentry all require a running Node server. It
 * CANNOT be statically exported (`output: "export"` would break every dynamic
 * route). So instead of bundling web assets into the app, the native iOS
 * WebView loads the live production site at https://savvo.app and we layer
 * native plugins (push, share, status bar, haptics) on top.
 *
 * Consequences of the server.url model:
 *  - `webDir: "public"` is a required placeholder only; nothing from it is
 *    actually served because the WebView points at the remote URL.
 *  - `cleartext: false` enforces HTTPS-only — never load the app over plain
 *    HTTP. The production origin is always TLS.
 *  - The WebView origin is the remote https://savvo.app origin (capacitor://
 *    is NOT used when server.url is set). The site's existing CSP therefore
 *    applies as-is to the in-app WebView. See SCAFFOLD summary for the one
 *    additive connect-src entry the user may want for the push token endpoint.
 */
const config: CapacitorConfig = {
  // Reverse-DNS app identifier. "app.savvo" mirrors the production domain
  // savvo.app reversed. This must match the bundle id configured in Xcode.
  appId: "app.savvo",
  appName: "Savvo",
  // Placeholder only — unused in server.url mode (see header comment).
  webDir: "public",
  server: {
    // Defaults to production. Override with CAPACITOR_SERVER_URL to point a
    // native build at a staging/preview origin without editing this committed
    // config (read at `cap sync` time on the build machine).
    url: process.env.CAPACITOR_SERVER_URL || "https://savvo.app",
    cleartext: false,
  },
  ios: {
    // Let the WebView extend under the status bar / home indicator; our CSS
    // uses env(safe-area-inset-*) to keep content clear of the notch.
    contentInset: "always",
  },
}

export default config
