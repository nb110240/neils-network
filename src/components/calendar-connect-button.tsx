"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, Loader2, Check } from "lucide-react"
import { useToast } from "@/components/ui/toast"

interface CalendarConnectButtonProps {
  isConnected: boolean
}

export function CalendarConnectButton({ isConnected }: CalendarConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const { addToast } = useToast()

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/calendar/connect")
      if (res.redirected) {
        window.location.href = res.url
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to connect calendar")
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to connect calendar",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to sync calendar")
      addToast({
        title: "Calendar synced",
        description: `${data.newContacts || 0} new contacts added from your calendar.`,
      })
    } catch (error) {
      addToast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  if (isConnected) {
    return (
      <div className="relative group">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4 text-emerald-500" />
          )}
          {syncing ? "Syncing..." : "Calendar Connected"}
        </Button>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 px-3 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          Syncs automatically once a day. Click to sync now.
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Calendar className="mr-2 h-4 w-4" />
      )}
      Connect Calendar
    </Button>
  )
}
