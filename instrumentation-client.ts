import * as Sentry from "@sentry/nextjs";
import {
  isShareTokenPath,
  redactSentryPayload,
  sentryRedactionOptions,
} from "./src/lib/sentry-redact";

// Replay snapshots record location.href, which beforeAddRecordingEvent cannot
// reach. Never start replay on a share page, where the URL is the credential.
const onSharePage =
  typeof window !== "undefined" && isShareTokenPath(window.location.pathname);

Sentry.init({
  // Strip /i/<token> and /s/<token> share-link credentials from events.
  ...sentryRedactionOptions,

  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",

  sendDefaultPii: true,

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay: 10% of all sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  integrations: onSharePage
    ? []
    : [
        Sentry.replayIntegration({
          // Navigation/fetch frames carry URLs; redact share tokens.
          beforeAddRecordingEvent: (event) => redactSentryPayload(event),
        }),
      ],

  // Filter out noisy browser errors
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection",
    "AbortError",
    "TypeError: Failed to fetch",
    "TypeError: NetworkError",
  ],
});

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
