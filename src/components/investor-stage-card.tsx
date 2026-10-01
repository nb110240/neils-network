"use client"

import { useState } from "react"
import Link from "next/link"
import type { Contact } from "@/lib/types"
import { INVESTOR_STAGES, type InvestorStage } from "@/lib/investor-stage"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"

interface InvestorStageCardProps {
  contact: Contact
  onUpdate: (updated: Contact) => void
}

// Where this person sits in your raise. Feeds the shareable raise snapshot.
export function InvestorStageCard({ contact, onUpdate }: InvestorStageCardProps) {
  const { addToast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  async function handleChange(value: string) {
    const previous = contact.investor_stage
    const next = (INVESTOR_STAGES.find((s) => s.value === value)?.value ?? null) as InvestorStage | null
    onUpdate({ ...contact, investor_stage: next })
    setIsSaving(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investor_stage: next }),
      })
      if (!res.ok) throw new Error("Failed to update")
      const { contact: updated } = await res.json()
      onUpdate(updated)
    } catch {
      onUpdate({ ...contact, investor_stage: previous })
      addToast({ title: "Couldn't save stage", description: "Try again in a moment.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="shadow-refined">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Raise stage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <label htmlFor="investor-stage" className="sr-only">Raise stage</label>
        <select
          id="investor-stage"
          value={contact.investor_stage ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isSaving}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
        >
          <option value="">Not an investor in this raise</option>
          {INVESTOR_STAGES.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-700 dark:text-stone-300">
          Stages power your{" "}
          <Link href="/settings#raise-snapshot" className="underline underline-offset-2">
            raise snapshot
          </Link>
          , which shares counts only, never names.
        </p>
      </CardContent>
    </Card>
  )
}
