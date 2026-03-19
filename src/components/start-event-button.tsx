"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Radio, Loader2 } from "lucide-react"

const DURATIONS = [
  { label: "2 hours", value: 2 },
  { label: "4 hours", value: 4 },
  { label: "8 hours", value: 8 },
]

export function StartEventButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [duration, setDuration] = useState(4)
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim() || isCreating) return
    setIsCreating(true)
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), duration_hours: duration }),
      })
      if (res.ok) {
        setOpen(false)
        setName("")
        setDuration(4)
        router.refresh()
      }
    } catch (err) {
      console.error("Failed to create event:", err)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 group">
          <Radio className="h-4 w-4" />
          Start Event Mode
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Event Mode</DialogTitle>
          <DialogDescription>
            All contacts added during this event will be grouped together.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label htmlFor="event-name" className="text-sm font-medium">
              Event Name
            </label>
            <input
              id="event-name"
              type="text"
              placeholder="e.g. AI Summit 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    duration === d.value
                      ? "bg-[var(--copper)]/10 text-[var(--copper)] border border-[var(--copper)]/30"
                      : "border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
          >
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
