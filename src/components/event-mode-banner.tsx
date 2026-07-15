"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Radio, X } from "lucide-react"

interface ActiveEvent {
  id: string
  name: string
  ends_at: string
  contact_count: number
}

export function EventModeBanner() {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [timeLeft, setTimeLeft] = useState("")
  const [isEnding, setIsEnding] = useState(false)

  useEffect(() => {
    fetchActiveEvent()
  }, [])

  useEffect(() => {
    if (!event) return
    const interval = setInterval(() => {
      const now = new Date()
      const end = new Date(event.ends_at)
      const diff = end.getTime() - now.getTime()
      if (diff <= 0) {
        setEvent(null)
        return
      }
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeLeft(hours > 0 ? `${hours}h ${mins}m` : `${mins}m`)
    }, 1000)
    return () => clearInterval(interval)
  }, [event])

  async function fetchActiveEvent() {
    try {
      const res = await fetch("/api/events/active")
      const data = await res.json()
      setEvent(data.event || null)
    } catch (err) {
      console.error("Failed to fetch active event:", err)
    }
  }

  async function endEvent() {
    setIsEnding(true)
    try {
      await fetch("/api/events/active", { method: "DELETE" })
      setEvent(null)
    } catch (err) {
      console.error("Failed to end event:", err)
    } finally {
      setIsEnding(false)
    }
  }

  if (!event) return null

  return (
    <div className="rounded-xl border border-[var(--copper)]/30 bg-[var(--copper)]/5 px-4 py-3 flex items-center justify-between gap-4 animate-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 h-8 w-8 rounded-lg bg-[var(--copper)]/10 flex items-center justify-center">
          <Radio className="h-4 w-4 text-[var(--copper-text)]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            Event Mode: {event.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {event.contact_count} contact{event.contact_count !== 1 ? "s" : ""} added &middot; {timeLeft} remaining
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 h-7 text-xs"
        onClick={endEvent}
        disabled={isEnding}
      >
        {isEnding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
        End Event
      </Button>
    </div>
  )
}
