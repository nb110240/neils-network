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
      if (!res.ok) throw new Error(data.message)
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
      if (!res.ok) throw new Error(data.message)
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
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        className="group"
      >
        {syncing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-2 h-4 w-4 text-emerald-500" />
        )}
        {syncing ? "Syncing..." : "Calendar Connected"}
      </Button>
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
