"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Merge, ArrowRight, X } from "lucide-react"

const DISMISS_KEY = "savvo:duplicates-banner-dismissed-at"
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24

export function DuplicatesBanner() {
  const [mounted, setMounted] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [contactsInvolved, setContactsInvolved] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (raw) {
        const ts = Number(raw)
        if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          setDismissed(true)
          return
        }
      }
    } catch {
      /* ignore storage access errors */
    }

    let cancelled = false
    fetch("/api/contacts/duplicates/count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setCount(data.count ?? 0)
        setContactsInvolved(data.contactsInvolved ?? 0)
      })
      .catch(() => {
        /* silent fail — banner just won't show */
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!mounted || dismissed || count === null || count === 0) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-center gap-3">
      <Merge className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
      <div className="flex-1 min-w-0 text-sm">
        <span className="font-medium text-amber-900 dark:text-amber-200">
          {contactsInvolved} contact{contactsInvolved !== 1 ? "s" : ""} look like duplicates.
        </span>{" "}
        <span className="text-amber-800/80 dark:text-amber-300/80">
          Review and merge to keep your network clean.
        </span>
      </div>
      <Link
        href="/settings#duplicates"
        className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 dark:text-amber-200 hover:underline shrink-0"
      >
        Review
        <ArrowRight className="h-3 w-3" />
      </Link>
      <button
        onClick={dismiss}
        className="shrink-0 text-amber-700/70 dark:text-amber-400/70 hover:text-amber-900 dark:hover:text-amber-200"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
