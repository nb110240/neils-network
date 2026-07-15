"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"

interface OnboardingBannerProps {
  contactCount: number
  plan?: string
}

const STORAGE_KEY = "savvo-onboarding-dismissed"

export function OnboardingBanner({ contactCount, plan }: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true
    return localStorage.getItem(STORAGE_KEY) === "true"
  })

  if (dismissed || contactCount >= 5) return null

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem(STORAGE_KEY, "true")
  }

  const progress = Math.min(contactCount, 5)

  return (
    <div className="rounded-xl border border-[var(--copper)]/30 bg-[var(--copper)]/5 px-4 py-3 flex items-center justify-between gap-4 animate-fade-in">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Getting started: {contactCount}/5 contacts added
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {plan === "pro" || plan === "team"
              ? `Add ${5 - contactCount} more to unlock daily digest emails.`
              : `Add ${5 - contactCount} more to see health scores in action.`}
          </p>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] transition-all duration-500 ease-out"
              style={{ width: `${(progress / 5) * 100}%` }}
            />
          </div>
        </div>
        <Button
          asChild
          size="sm"
          className="shrink-0 h-8 text-xs bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
        >
          <Link href="/add">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Contact
          </Link>
        </Button>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors"
        aria-label="Dismiss onboarding banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
