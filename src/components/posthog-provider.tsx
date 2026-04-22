"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import posthog from "posthog-js"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

interface PostHogProviderProps {
  /** Authenticated user id if known — triggers identify on mount. */
  userId?: string | null
  userEmail?: string | null
}

export function PostHogProvider({ userId, userEmail }: PostHogProviderProps) {
  const initialized = useRef(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastIdentified = useRef<string | null>(null)

  useEffect(() => {
    if (!POSTHOG_KEY || initialized.current) return
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
      // Respect user DNT and browser privacy signals by default; the
      // product-analytics use case doesn't warrant overriding those.
      respect_dnt: true,
    })
    initialized.current = true
  }, [])

  // Identify / reset on auth state change.
  useEffect(() => {
    if (!POSTHOG_KEY || !initialized.current) return
    if (userId && lastIdentified.current !== userId) {
      posthog.identify(userId, userEmail ? { email: userEmail } : undefined)
      lastIdentified.current = userId
    } else if (!userId && lastIdentified.current) {
      posthog.reset()
      lastIdentified.current = null
    }
  }, [userId, userEmail])

  // Manual pageview capture so app-router transitions are recorded.
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
