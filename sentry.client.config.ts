import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,

  // Filter out known browser-side noise
  ignoreErrors: [
    // React streaming hydration errors caused by browser extensions
    // (Grammarly, ad blockers, etc.) modifying the DOM during hydration
    "Cannot read properties of null (reading 'parentNode')",
    "Cannot read property 'parentNode' of null",
    // ResizeObserver noise from browser extensions
    "ResizeObserver loop",
    // Network errors from flaky connections
    "Failed to fetch",
    "NetworkError",
    "Load failed",
  ],
});
