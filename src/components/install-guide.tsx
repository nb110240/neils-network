"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Check, Share, Plus, Smartphone, Monitor } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type Platform = "loading" | "ios" | "chromium" | "installed" | "other"

export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("loading")
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone
    if (isStandalone) {
      setPlatform("installed")
      return
    }

    const ua = navigator.userAgent || ""
    const isIos = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)
    if (isIos) {
      setPlatform("ios")
      return
    }

    setPlatform("other")

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setPlatform("chromium")
    }
    window.addEventListener("beforeinstallprompt", handler)

    const installed = () => setPlatform("installed")
    window.addEventListener("appinstalled", installed)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", installed)
    }
  }, [])

  async function install() {
    if (!deferred) return
    setInstalling(true)
    try {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === "accepted") setPlatform("installed")
    } finally {
      setInstalling(false)
    }
  }

  return (
    <Card className="shadow-refined">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-normal">
          <Download className="h-5 w-5 text-[var(--copper)]" />
          Install Savvo on your device
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Get a home-screen icon, faster launches, and offline access to your recent contacts.
        </p>

        {platform === "installed" && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 px-4 py-3 text-sm">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-900 dark:text-emerald-200 font-medium">
              You're running the installed app. Nothing to do.
            </span>
          </div>
        )}

        {platform === "chromium" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Monitor className="h-4 w-4" />
              Detected: Chrome, Edge, or Brave
            </div>
            <Button
              onClick={install}
              disabled={installing}
              className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
            >
              {installing ? "Installing..." : "Install Savvo"}
            </Button>
          </div>
        )}

        {platform === "ios" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              Detected: iOS Safari
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--copper)]/10 text-[var(--copper)] font-semibold text-xs flex items-center justify-center">
                  1
                </span>
                <span className="flex-1">
                  Tap the <Share className="inline h-4 w-4 align-text-bottom mx-1" /> Share button at the bottom of the screen.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--copper)]/10 text-[var(--copper)] font-semibold text-xs flex items-center justify-center">
                  2
                </span>
                <span className="flex-1">
                  Scroll down and tap <Plus className="inline h-3.5 w-3.5 align-text-bottom mx-1 px-0.5 border rounded" />
                  <span className="font-medium">Add to Home Screen</span>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--copper)]/10 text-[var(--copper)] font-semibold text-xs flex items-center justify-center">
                  3
                </span>
                <span className="flex-1">
                  Tap <span className="font-medium">Add</span> in the top right. Open Savvo from your home screen for the full app experience.
                </span>
              </li>
            </ol>
          </div>
        )}

        {platform === "other" && (
          <div className="space-y-2 text-sm">
            <p>
              Your browser doesn't expose an automatic install prompt. You can usually still install
              via your browser's menu. Look for "Install app", "Add to Home Screen", or a{" "}
              <Download className="inline h-3.5 w-3.5 align-text-bottom mx-1" /> icon in the address bar.
            </p>
            <p className="text-muted-foreground">
              On Android Chrome it's <span className="font-mono text-xs">⋮ → Install app</span>. On
              desktop Chrome / Edge it's the install icon at the right of the address bar.
            </p>
          </div>
        )}

        {platform === "loading" && (
          <p className="text-sm text-muted-foreground">Checking how you got here…</p>
        )}
      </CardContent>
    </Card>
  )
}
