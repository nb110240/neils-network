"use client"

import { useState } from "react"
import { Contact } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Calendar, Clock, RefreshCw, X, Check } from "lucide-react"

const CADENCE_PRESETS = [
  { label: "Weekly", days: 7 },
  { label: "Every 2 weeks", days: 14 },
  { label: "Monthly", days: 30 },
  { label: "Quarterly", days: 90 },
] as const

interface ScheduleCardProps {
  contact: Contact
  onUpdate: (updated: Contact) => void
}

export function ScheduleCard({ contact, onUpdate }: ScheduleCardProps) {
  const { addToast } = useToast()
  const [isSettingCadence, setIsSettingCadence] = useState(false)
  const [isSettingFollowUp, setIsSettingFollowUp] = useState(false)
  const [customDays, setCustomDays] = useState("")
  const [followUpDate, setFollowUpDate] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isSnoozing, setIsSnoozing] = useState(false)

  const today = new Date().toISOString().split("T")[0]
  const isSnoozed = contact.snoozed_until && contact.snoozed_until >= today

  async function updateContact(data: Record<string, unknown>) {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update")
      const { contact: updated } = await res.json()
      onUpdate(updated)
      return true
    } catch {
      addToast({ title: "Couldn't save schedule", description: "Try again in a moment.", variant: "destructive" })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSetCadence(days: number) {
    const ok = await updateContact({ cadence_days: days })
    if (ok) {
      setIsSettingCadence(false)
      setCustomDays("")
      addToast({ title: "Cadence set", description: `Every ${days} days` })
    }
  }

  async function handleClearCadence() {
    const ok = await updateContact({ cadence_days: null })
    if (ok) {
      addToast({ title: "Cadence removed" })
    }
  }

  async function handleSetFollowUp() {
    if (!followUpDate) return
    const ok = await updateContact({ scheduled_follow_up: followUpDate })
    if (ok) {
      setIsSettingFollowUp(false)
      setFollowUpDate("")
      addToast({ title: "Follow-up scheduled", description: formatDate(followUpDate) })
    }
  }

  async function handleClearFollowUp() {
    const ok = await updateContact({ scheduled_follow_up: null })
    if (ok) {
      addToast({ title: "Follow-up cleared" })
    }
  }

  async function handleSnooze(days: number) {
    setIsSnoozing(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      })
      if (!res.ok) throw new Error("Failed to snooze")
      const { contact: updated } = await res.json()
      onUpdate(updated)
      addToast({ title: "Snoozed", description: `Reminders paused for ${days} days` })
    } catch {
      addToast({ title: "Couldn't snooze", description: "Try again in a moment.", variant: "destructive" })
    } finally {
      setIsSnoozing(false)
    }
  }

  async function handleUnsnooze() {
    setIsSnoozing(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/snooze`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to unsnooze")
      const { contact: updated } = await res.json()
      onUpdate(updated)
      addToast({ title: "Unsnoozed" })
    } catch {
      addToast({ title: "Couldn't unsnooze", description: "Try again in a moment.", variant: "destructive" })
    } finally {
      setIsSnoozing(false)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  function formatDaysUntil(dateStr: string) {
    const diff = Math.ceil(
      (new Date(dateStr).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (diff < 0) return `${Math.abs(diff)} days overdue`
    if (diff === 0) return "Today"
    if (diff === 1) return "Tomorrow"
    return `in ${diff} days`
  }

  function cadenceLabel(days: number) {
    const preset = CADENCE_PRESETS.find((p) => p.days === days)
    if (preset) return preset.label
    return `Every ${days} days`
  }

  const hasCadence = contact.cadence_days && contact.cadence_days >= 1
  const hasFollowUp = contact.scheduled_follow_up && contact.scheduled_follow_up >= today
  const hasSchedule = hasCadence || hasFollowUp

  return (
    <Card className="shadow-refined">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--copper-text)]" />
          Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current schedule display */}
        {hasCadence && (
          <div className="flex items-center justify-between rounded-lg bg-stone-50 dark:bg-stone-900 px-3 py-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-[var(--copper-text)]" />
              <span className="text-sm font-medium">{cadenceLabel(contact.cadence_days!)}</span>
            </div>
            <div className="flex items-center gap-2">
              {contact.next_due_date && (
                <span className="text-xs text-muted-foreground">
                  Next: {formatDaysUntil(contact.next_due_date)}
                </span>
              )}
              <button
                onClick={handleClearCadence}
                disabled={isSaving}
                className="text-muted-foreground hover:text-foreground p-0.5"
                title="Remove cadence"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {hasFollowUp && (
          <div className="flex items-center justify-between rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">Follow-up: {formatDate(contact.scheduled_follow_up!)}</span>
              <span className="text-xs text-muted-foreground">
                ({formatDaysUntil(contact.scheduled_follow_up!)})
              </span>
            </div>
            <button
              onClick={handleClearFollowUp}
              disabled={isSaving}
              className="text-muted-foreground hover:text-foreground p-0.5"
              title="Clear follow-up"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {isSnoozed && (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium">Snoozed until {formatDate(contact.snoozed_until!)}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUnsnooze}
              disabled={isSnoozing}
              className="h-6 text-xs"
            >
              Unsnooze
            </Button>
          </div>
        )}

        {/* Cadence setter */}
        {isSettingCadence ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Set check-in cadence</p>
            <div className="flex flex-wrap gap-1.5">
              {CADENCE_PRESETS.map((preset) => (
                <Button
                  key={preset.days}
                  size="sm"
                  variant={contact.cadence_days === preset.days ? "default" : "outline"}
                  onClick={() => handleSetCadence(preset.days)}
                  disabled={isSaving}
                  className="h-7 text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="365"
                placeholder="Custom days"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                className="w-28 h-7 rounded-md border border-input bg-background px-2 text-xs"
              />
              {customDays && (
                <Button
                  size="sm"
                  onClick={() => handleSetCadence(parseInt(customDays))}
                  disabled={isSaving || !customDays || parseInt(customDays) < 1}
                  className="h-7 text-xs"
                >
                  <Check className="mr-1 h-3 w-3" />
                  Set
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setIsSettingCadence(false); setCustomDays("") }}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : isSettingFollowUp ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Schedule a follow-up</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                min={today}
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
              />
              <Button
                size="sm"
                onClick={handleSetFollowUp}
                disabled={isSaving || !followUpDate}
                className="h-7 text-xs"
              >
                <Check className="mr-1 h-3 w-3" />
                Set
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setIsSettingFollowUp(false); setFollowUpDate("") }}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSettingCadence(true)}
              className="h-7 text-xs"
            >
              <RefreshCw className="mr-1.5 h-3 w-3" />
              {hasCadence ? "Change Cadence" : "Set Cadence"}
            </Button>
            {!hasFollowUp && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsSettingFollowUp(true)}
                className="h-7 text-xs"
              >
                <Calendar className="mr-1.5 h-3 w-3" />
                Schedule Follow-up
              </Button>
            )}
          </div>
        )}

        {/* Snooze buttons */}
        {!isSnoozed && !isSettingCadence && !isSettingFollowUp && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <span className="text-xs text-muted-foreground">Snooze:</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSnooze(3)}
              disabled={isSnoozing}
              className="h-6 text-xs text-muted-foreground"
            >
              3 days
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSnooze(7)}
              disabled={isSnoozing}
              className="h-6 text-xs text-muted-foreground"
            >
              1 week
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSnooze(14)}
              disabled={isSnoozing}
              className="h-6 text-xs text-muted-foreground"
            >
              2 weeks
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
