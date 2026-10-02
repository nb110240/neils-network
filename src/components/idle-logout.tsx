"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { clearOfflineData } from "@/lib/clear-offline-cache"

const IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 24 // 24 hours of no activity
const CHECK_INTERVAL_MS = 1000 * 60 * 5 // re-check every 5 minutes
const LAST_ACTIVITY_KEY = "savvo:last-activity-at"

/**
 * Signs the user out after IDLE_TIMEOUT_MS of no activity, across tabs.
 * Activity = mousemove, keydown, click, scroll, or touchstart. The
 * timestamp is written to localStorage so multiple tabs share one
 * idle clock instead of each tab resetting the other. This is the
 * cheap layer; Supabase's session lifetime is the ceiling.
 */
export function IdleLogout() {
  const router = useRouter()
  const loggedOut = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    let checkTimer: ReturnType<typeof setInterval> | null = null

    function markActive() {
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
    }

    async function checkIdle() {
      if (loggedOut.current) return
      let last: number | null = null
      try {
        const raw = localStorage.getItem(LAST_ACTIVITY_KEY)
        last = raw ? Number(raw) : null
      } catch {
        return
      }
      if (!last || Number.isNaN(last)) {
        markActive()
        return
      }
      if (Date.now() - last > IDLE_TIMEOUT_MS) {
        loggedOut.current = true
        try {
          await supabase.auth.signOut()
          await clearOfflineData()
        } finally {
          router.replace("/login?reason=idle")
        }
      }
    }

    // Seed on mount so a freshly opened tab doesn't immediately trigger.
    markActive()

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ]
    for (const ev of events) {
      window.addEventListener(ev, markActive, { passive: true })
    }
    checkTimer = setInterval(checkIdle, CHECK_INTERVAL_MS)
    // First check 30s after mount so a stale localStorage entry from a
    // closed tab triggers sign-out quickly if this really is a resumed
    // session past the threshold.
    const initialCheck = setTimeout(checkIdle, 30_000)

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, markActive)
      }
      if (checkTimer) clearInterval(checkTimer)
      clearTimeout(initialCheck)
    }
  }, [router])

  return null
}
