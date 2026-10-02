import * as Sentry from "@sentry/nextjs";
import { sentryRedactionOptions } from "./src/lib/sentry-redact";

Sentry.init({
  // Strip /i/<token> and /s/<token> share-link credentials from events.
  ...sentryRedactionOptions,

  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Attach local variable values to stack frames
  includeLocalVariables: true,

  enableLogs: true,
});
