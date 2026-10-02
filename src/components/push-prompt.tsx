"use client"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { captureEvent } from "@/components/posthog-provider"
import { dismissPushPrompt, enablePush, getPushPermission, pushPromptDismissedRecently } from "@/lib/native/push"

// Set by the dashboard walkthrough (components/dashboard-walkthrough.tsx)
// when it is finished or skipped. One thing at a time: the tour first, then
// the notification ask on a later visit.
const DASHBOARD_TOUR_KEY = "savvo-dashboard-tour-complete"

function tourFinished(): boolean {
  try {
    return localStorage.getItem(DASHBOARD_TOUR_KEY) === "true"
  } catch {
    return true
  }
}

/**
 * Pre-permission ask for push, shown in the app on the dashboard before the
 * one-shot iOS system dialog. Asking in context, with a reason, gets far more
 * people to say yes than a dialog at launch, and "Not now" keeps the system
 * dialog unused so we can ask again later.
 */
export function PushPrompt() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (pushPromptDismissedRecently() || !tourFinished()) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void getPushPermission().then((permission) => {
        if (!cancelled && permission === "prompt") {
          setVisible(true)
          captureEvent("push_prompt_shown")
        }
      })
    }, 1500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  if (!visible) return null

  async function turnOn() {
    setBusy(true)
    const result = await enablePush()
    captureEvent("push_prompt_answered", { result })
    // Denied or still undecided: don't nag again for a while.
    if (result !== "granted") dismissPushPrompt()
    setVisible(false)
  }

  function notNow() {
    dismissPushPrompt()
    captureEvent("push_prompt_answered", { result: "not_now" })
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Turn on notifications"
      className="fixed inset-x-4 z-[60] mx-auto max-w-md animate-fade-in rounded-2xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-700 dark:bg-stone-900"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950">
          <Bell className="h-4 w-4 text-[var(--copper-text)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-stone-900 dark:text-stone-100">Never miss a promise</p>
          <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">
            Get a heads-up when something you promised is due or meeting notes are ready to review.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              className="min-h-11 flex-1 border-0 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90"
              onClick={turnOn}
              disabled={busy}
            >
              Turn on
            </Button>
            <Button variant="outline" className="min-h-11 flex-1" onClick={notNow} disabled={busy}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={notNow}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
