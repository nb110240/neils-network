"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import posthog from "posthog-js"
import { createClient } from "@/lib/supabase/client"

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
  const [identity, setIdentity] = useState<{ id: string; email: string | null } | null>(null)

  useEffect(() => {
    if (!POSTHOG_KEY || initialized.current) return
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
      respect_dnt: true,
    })
    initialized.current = true

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIdentity({ id: user.id, email: user.email ?? null })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIdentity(
        session?.user
          ? { id: session.user.id, email: session.user.email ?? null }
          : null
      )
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!POSTHOG_KEY || !initialized.current) return
    if (identity && lastIdentified.current !== identity.id) {
      posthog.identify(identity.id, identity.email ? { email: identity.email } : undefined)
      lastIdentified.current = identity.id
    } else if (!identity && lastIdentified.current) {
      posthog.reset()
      lastIdentified.current = null
    }
  }, [identity])

  useEffect(() => {
    if (!POSTHOG_KEY || !initialized.current || !pathname) return
    const query = searchParams?.toString()
    const url = query ? `${pathname}?${query}` : pathname
    posthog.capture("$pageview", { $current_url: url, path: pathname })
  }, [pathname, searchParams])

  return null
}

export function captureEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  if (!POSTHOG_KEY) return
  try {
    posthog.capture(event, properties)
  } catch {
    /* analytics must never break the app */
  }
}
