"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useIsNative } from "@/lib/native/use-is-native"
import { enablePush, getPushPermission, type PushPermission } from "@/lib/native/push"

/**
 * Push notifications row, shown only inside the iOS/Android app. Combines
 * the account switch (push_enabled) with this phone's system permission.
 */
export function PushPreference({ initialEnabled }: { initialEnabled: boolean }) {
  const { addToast } = useToast()
  const native = useIsNative()
  const [permission, setPermission] = useState<PushPermission | null>(null)
  const [enabled, setEnabled] = useState(initialEnabled)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (native) void getPushPermission().then(setPermission)
  }, [native])

  if (!native || permission === null || permission === "unsupported") return null

  async function save(next: boolean) {
    setBusy(true)
    setEnabled(next)
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push_enabled: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setEnabled(!next)
      addToast({ title: "Error", description: "Couldn't update push notifications.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function turnOn() {
    setBusy(true)
    const result = await enablePush()
    setPermission(result)
    setBusy(false)
    if (result === "granted" && !enabled) await save(true)
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
      <div className="flex min-w-0 items-start gap-3">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[var(--copper-text)]" />
        <div className="min-w-0">
          <p id="push-pref-label" className="text-sm font-medium text-stone-900 dark:text-stone-100">Push notifications</p>
          <p className="text-xs text-stone-700 dark:text-stone-300">
            {permission === "denied"
              ? "Turned off for Savvo in your phone's Settings app. Turn them on there to get reminders."
              : "Promises that are due, meeting notes ready to review, and intro follow-ups."}
          </p>
        </div>
      </div>
      {permission === "prompt" ? (
        <Button size="sm" variant="outline" className="min-h-11 shrink-0" onClick={turnOn} disabled={busy}>
          Turn on
        </Button>
      ) : permission === "granted" ? (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="push-pref-label"
          disabled={busy}
          onClick={() => void save(!enabled)}
          className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--copper)] focus-visible:ring-offset-2 disabled:opacity-60 ${
            enabled ? "bg-[var(--copper)]" : "bg-stone-300 dark:bg-stone-600"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      ) : null}
    </div>
  )
}
