"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Loader2, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"

type DigestFrequency = "daily" | "weekly" | "never"

const FREQUENCY_OPTIONS: { value: DigestFrequency; label: string; description: string; proOnly?: boolean }[] = [
  { value: "daily", label: "Daily", description: "Get a digest every morning", proOnly: true },
  { value: "weekly", label: "Weekly", description: "Get a digest every Monday" },
  { value: "never", label: "Never", description: "No digest emails" },
]

export function NotificationPreferences() {
  const { addToast } = useToast()
  const [frequency, setFrequency] = useState<DigestFrequency>("weekly")
  const [canUseDaily, setCanUseDaily] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [savedFrequency, setSavedFrequency] = useState<DigestFrequency>("weekly")

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/notifications")
        if (res.ok) {
          const data = await res.json()
          setFrequency(data.digest_frequency)
          setSavedFrequency(data.digest_frequency)
          setCanUseDaily(data.can_use_daily)
        }
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleFrequencyChange = (value: DigestFrequency) => {
    if (value === "daily" && canUseDaily === false) return
    setFrequency(value)
    setHasChanges(value !== savedFrequency)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_frequency: frequency }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      setSavedFrequency(frequency)
      setHasChanges(false)
      addToast({ title: "Saved", description: "Notification preferences updated." })
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save preferences",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Digest Frequency</Label>
        {FREQUENCY_OPTIONS.map((option) => {
          const locked = Boolean(option.proOnly) && canUseDaily === false
          return (
            <label
              key={option.value}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all touch-target ${
                locked
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="digest-frequency"
                value={option.value}
                checked={frequency === option.value}
                disabled={locked}
                onChange={() => handleFrequencyChange(option.value)}
                className="h-4 w-4 accent-[var(--copper)] shrink-0 disabled:cursor-not-allowed"
              />
              <div className="min-w-0">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  {option.label}
                  {locked && (
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-1 text-xs text-[var(--copper)] font-medium hover:underline"
                    >
                      <Crown className="h-3 w-3" /> Pro
                    </Link>
                  )}
                </span>
                <p className="text-xs text-muted-foreground">
                  {locked ? "Daily digests are a Pro feature" : option.description}
                </p>
              </div>
            </label>
          )
        })}
      </div>

      {hasChanges && (
        <Button
          onClick={handleSave}
          disabled={isSaving}
          variant="outline"
          size="sm"
        >
          {isSaving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Save Preferences
        </Button>
      )}
    </div>
  )
}
