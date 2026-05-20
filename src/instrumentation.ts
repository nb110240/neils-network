import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Surface missing required config as one clear boot log + Sentry alert,
    // instead of cryptic per-request 500s deep inside a route.
    const { validateEnv } = await import("./lib/env");
    const { ok, missing } = validateEnv();
    if (!ok) {
      const msg =
        `[env] Missing required environment variables: ${missing.join(", ")}. ` +
        `The app will not function correctly until these are set.`;
      console.error(msg);
      Sentry.captureMessage(msg, "fatal");
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Automatically captures all unhandled server-side request errors
export const onRequestError = Sentry.captureRequestError;
