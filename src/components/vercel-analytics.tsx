"use client"

import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { redactShareTokens } from "@/lib/redact-url"

// Client wrapper so the server root layout can pass beforeSend callbacks.
export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: redactShareTokens(event.url) })} />
      <SpeedInsights beforeSend={(event) => ({ ...event, url: redactShareTokens(event.url) })} />
    </>
  )
}
