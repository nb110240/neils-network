"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Clock3, FileText, HandCoins } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import type { Commitment } from "@/lib/types"

function dueLabel(dueAt: string | null): string | null {
  if (!dueAt) return null
  const date = new Date(dueAt)
  const today = new Date()
  const days = Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return "Due today"
  if (days === 1) return "Due tomorrow"
  return `Due ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
}

export function ContactCommitments({ contactId }: { contactId: string }) {
  const { addToast } = useToast()
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/commitments?status=active&contact_id=${contactId}`)
      .then(async (response) => response.ok ? response.json() : { commitments: [] })
      .then((data) => setCommitments(data.commitments || []))
      .catch(() => setCommitments([]))
      .finally(() => setIsLoading(false))
  }, [contactId])

  async function complete(commitment: Commitment) {
    setBusyId(commitment.id)
    try {
      const response = await fetch(`/api/commitments/${commitment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      })
      if (!response.ok) throw new Error("Failed")
      setCommitments((current) => current.filter((item) => item.id !== commitment.id))
      addToast({
        title: "Action completed",
        description: commitment.title,
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await fetch(`/api/commitments/${commitment.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "open" }),
            })
            if (undo.ok) setCommitments((current) => [commitment, ...current])
          },
        },
      })
    } catch {
      addToast({ title: "Could not complete action", description: "Please try again.", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading || commitments.length === 0) return null

  return (
    <Card className="shadow-refined">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-medium">Open commitments</CardTitle>
          <Button variant="ghost" size="sm" asChild className="min-h-11 text-xs">
            <Link href={`/capture?contact=${contactId}`}><FileText className="mr-1.5 h-3.5 w-3.5" /> Capture meeting</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {commitments.map((commitment) => {
          const due = dueLabel(commitment.due_at)
          return (
            <div key={commitment.id} className="flex flex-col gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-700 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--copper)]/10">
                  {commitment.direction === "user_owes" ? <Check className="h-4 w-4 text-[var(--copper-text)]" /> : <HandCoins className="h-4 w-4 text-[var(--copper-text)]" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{commitment.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">{commitment.direction === "user_owes" ? "I owe this" : "Waiting on them"}</Badge>
                    {due && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />{due}</span>}
                  </div>
                  {commitment.evidence && <p className="mt-2 text-xs text-stone-700 dark:text-stone-300">From your meeting: “{commitment.evidence}”</p>}
                </div>
              </div>
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => complete(commitment)} disabled={busyId === commitment.id}>
                <Check className="mr-2 h-4 w-4" /> {commitment.direction === "user_owes" ? "Done" : "Received"}
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
