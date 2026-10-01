"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import posthog from "posthog-js"
import { track as trackVercel } from "@vercel/analytics"
import { createClient } from "@/lib/supabase/client"
import { redactShareTokens } from "@/lib/redact-url"
import {
  attributionEventProperties,
  attributionFromUserMetadata,
  captureFirstTouchAttribution,
  campaignArrivalEvents,
  clearFirstTouchAttribution,
  getFirstTouchAttribution,
  persistFirstTouchAttribution,
  resolveAuthenticatedAttribution,
  restoreAuthenticatedAttribution,
  type FirstTouchAttribution,
} from "@/lib/attribution"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

/**
 * Mounts client-side, initializes PostHog, listens for auth state
 * changes, and captures pageviews. Doing the user lookup here (instead
 * of passing user props from the root layout) keeps the root layout
 * synchronous, which avoids forcing every route into dynamic rendering
 * and the hydration regressions that come with it.
 */
export function PostHogProvider() {
  const initialized = useRef(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastIdentified = useRef<string | null>(null)
  const lastCampaignArrival = useRef<string | null>(null)
  const [identity, setIdentity] = useState<{
    id: string
    email: string | null
    createdAt: string
    firstTouch: FirstTouchAttribution | null
  } | null>(null)

  useEffect(() => {
    if (POSTHOG_KEY && !initialized.current) {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false,
        capture_pageleave: true,
        person_profiles: "identified_only",
        respect_dnt: true,
        // Feature flags are unused; skipping the /flags request also keeps
        // initial-URL person properties (which can hold a share token) from
        // being sent outside before_send.
        advanced_disable_flags: true,
        // Strip share-link tokens from every string property, including
        // session-entry URLs and $set/$set_once person properties.
        before_send: (event) => {
          if (!event) return event
          for (const bag of [event.properties, event.$set, event.$set_once]) {
            if (!bag) continue
            for (const [key, value] of Object.entries(bag)) {
              if (typeof value === "string") bag[key] = redactShareTokens(value)
            }
          }
          return event
        },
      })
      initialized.current = true
    }

    const supabase = createClient()
    // Session metadata is sufficient for analytics and avoids a network auth
    // lookup on every public marketing page. This is not an authorization
    // decision; protected routes continue to validate users server-side.
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user
      if (user) {
        setIdentity({
          id: user.id,
          email: user.email ?? null,
          createdAt: user.created_at,
          firstTouch: attributionFromUserMetadata(user.user_metadata),
        })
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIdentity(
        session?.user
          ? {
              id: session.user.id,
              email: session.user.email ?? null,
              createdAt: session.user.created_at,
              firstTouch: attributionFromUserMetadata(
                session.user.user_metadata
              ),
            }
          : null
      )
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (identity && lastIdentified.current !== identity.id) {
      const browserFirstTouch = getFirstTouchAttribution()
      const resolved = resolveAuthenticatedAttribution(
        identity.firstTouch,
        browserFirstTouch,
        identity.createdAt
      )
      const firstTouch = identity.firstTouch
        ? restoreAuthenticatedAttribution(identity.firstTouch)
        : resolved.firstTouch
          ? persistFirstTouchAttribution(resolved.firstTouch)
          : null
      if (resolved.shouldClearBrowser) {
        // A campaign visit followed by an existing-user login is traffic, not
        // acquisition. Keep the arrival event but do not contaminate the
        // user's activation and retention events with a false first touch.
        clearFirstTouchAttribution()
      }
      const firstTouchProperties = attributionEventProperties(firstTouch)
      if (POSTHOG_KEY && initialized.current) {
        posthog.identify(
          identity.id,
          identity.email ? { email: identity.email } : undefined,
          firstTouchProperties
        )
      }

      try {
        const today = new Date().toISOString().slice(0, 10)
        const activeKey = `savvo-last-active-date:${identity.id}`
        const previousDate = window.localStorage.getItem(activeKey)
        if (previousDate !== today) {
          captureEvent("authenticated_daily_active", { active_date: today })
          if (previousDate && !Number.isNaN(Date.parse(previousDate))) {
            const daysSinceLastActive = Math.max(
              1,
              Math.round(
                (new Date(today).getTime() - new Date(previousDate).getTime()) /
                  (24 * 60 * 60 * 1000)
              )
            )
            captureEvent("returning_active_user", {
              active_date: today,
              days_since_last_active: daysSinceLastActive,
            })
          }
          window.localStorage.setItem(activeKey, today)
        }
      } catch {
        // Storage may be unavailable in private browsing. Skip retention
        // tracking rather than allowing analytics to affect the product.
      }
      lastIdentified.current = identity.id
    } else if (!identity && lastIdentified.current) {
      if (POSTHOG_KEY && initialized.current) posthog.reset()
      clearFirstTouchAttribution()
      lastIdentified.current = null
    }
  }, [identity])

  useEffect(() => {
    if (!pathname) return
    const query = searchParams?.toString()
    const url = query ? `${pathname}?${query}` : pathname
    const attribution = captureFirstTouchAttribution(
      url,
      typeof document === "undefined" ? undefined : document.referrer
    )

    if (POSTHOG_KEY && initialized.current) {
      posthog.register(attributionEventProperties(attribution.firstTouch))
      posthog.capture("$pageview", { $current_url: redactShareTokens(url), path: redactShareTokens(pathname) })
    }

    const arrivalEvents = campaignArrivalEvents(attribution.currentTouch)
    if (arrivalEvents.length > 0 && lastCampaignArrival.current !== url) {
      const properties = {
        ...attributionEventProperties(attribution.currentTouch, "current_touch_"),
        first_touch_was_new: attribution.isNew,
      }
      for (const event of arrivalEvents) captureEvent(event, properties)
      lastCampaignArrival.current = url
    }
  }, [pathname, searchParams])

  return null
}

export function captureEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  const attribution = attributionEventProperties(getFirstTouchAttribution())
  const flatProperties = Object.fromEntries(
    Object.entries({ ...attribution, ...properties }).filter(
      ([, value]) =>
        value === null ||
        value === undefined ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    )
  ) as Record<string, string | number | boolean | null | undefined>

  try {
    if (typeof window !== "undefined" && !window.va) {
      // PostHogProvider mounts before <Analytics /> in the root layout. Queue
      // first-paint events ourselves so campaign arrivals are not lost in the
      // small window before Vercel installs its browser dispatcher.
      window.vaq = window.vaq || []
      window.vaq.push([
        "event",
        { name: event, data: flatProperties },
      ])
    } else {
      trackVercel(event, flatProperties)
    }
    if (POSTHOG_KEY) posthog.capture(event, flatProperties)
  } catch {
    /* analytics must never break the app */
  }
}

const FIRST_CONTACT_TRACKED_KEY = "savvo-first-contact-tracked"
// Set by the first-contact confetti; users who saw it already activated.
const FIRST_CONTACT_CELEBRATED_KEY = "savvo-first-contact-celebrated"

/**
 * Records contact creation from any path (add, LinkedIn, scan, CSV/Google
 * import, inbox approval) and fires `first_contact_created` once per
 * browser, so activation is counted however the user brings people in.
 */
export function trackContactsCreated(
  method: string,
  count = 1,
  properties?: Record<string, unknown>
) {
  if (count < 1) return
  captureEvent("contact_created", { method, count, ...properties })
  try {
    if (
      localStorage.getItem(FIRST_CONTACT_TRACKED_KEY) === "true" ||
      localStorage.getItem(FIRST_CONTACT_CELEBRATED_KEY) === "true"
    ) {
      return
    }
    localStorage.setItem(FIRST_CONTACT_TRACKED_KEY, "true")
  } catch {
    return
  }
  captureEvent("first_contact_created", { method, count })
}
