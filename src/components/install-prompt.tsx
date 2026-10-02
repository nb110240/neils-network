"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISS_KEY = "savvo:install-prompt-dismissed-at"
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

export function InstallPrompt() {
  const [mounted, setMounted] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (raw) {
        const ts = Number(raw)
        if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          setDismissed(true)
        }
      }
    } catch {
      /* ignore */
    }

    // If already running as an installed PWA, don't prompt.
    if (
      typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone)
    ) {
      setDismissed(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (!mounted || dismissed || !deferred) return null

  async function install() {
    if (!deferred) return
    setInstalling(true)
    try {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === "accepted") {
        setDeferred(null)
      } else {
        dismiss()
      }
    } finally {
      setInstalling(false)
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <div className="rounded-xl border border-[var(--copper)]/30 bg-[var(--copper)]/5 px-4 py-3 flex items-center gap-3">
      <Download className="h-4 w-4 shrink-0 text-[var(--copper-text)]" />
      <div className="flex-1 min-w-0 text-sm">
        <span className="font-medium">Install Savvo on your device</span>{" "}
        <span className="text-muted-foreground">
          for faster access, a home-screen icon, and offline access to recent contacts.
        </span>
      </div>
      <Button
        size="sm"
        onClick={install}
        disabled={installing}
        variant="copper"
        className="shrink-0 h-8 text-xs"
      >
        {installing ? "Installing..." : "Install"}
      </Button>
      <button
        onClick={dismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
