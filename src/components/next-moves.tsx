"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Clock3, Inbox, Sparkles, Undo2, UserRoundCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { captureEvent } from "@/components/posthog-provider"
import type { NextMove } from "@/lib/next-moves"

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function moveIcon(kind: NextMove["kind"]) {
  if (kind === "review") return Inbox
  if (kind === "waiting") return UserRoundCheck
  if (kind === "commitment") return Check
  if (kind === "intro") return Users
  return Clock3
}

export function NextMoves({
  moves: initialMoves,
  limit = 3,
  showHeader = true,
}: {
  moves: NextMove[]
  limit?: number | null
  showHeader?: boolean
}) {
  const router = useRouter()
  const [moves, setMoves] = useState(initialMoves)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [undoMove, setUndoMove] = useState<NextMove | null>(null)
  const [snoozeId, setSnoozeId] = useState<string | null>(null)
  const visibleMoves = limit === null ? moves : moves.slice(0, limit)

  async function updateCommitment(move: NextMove, body: Record<string, unknown>) {
    const commitmentId = move.id.replace("commitment:", "")
    setBusyId(move.id)
    setError(null)
    try {
      const response = await fetch(`/api/commitments/${commitmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not update this action")
      setMoves((current) => current.filter((candidate) => candidate.id !== move.id))
      setSnoozeId(null)
      if (body.status === "completed") {
        setUndoMove(move)
        captureEvent("commitment_completed", { direction: move.kind === "waiting" ? "contact_owes" : "user_owes" })
      } else if (body.status === "snoozed") {
        captureEvent("commitment_snoozed")
      }
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update this action")
    } finally {
      setBusyId(null)
    }
  }

  async function undoCompletion() {
    if (!undoMove) return
    const move = undoMove
    setUndoMove(null)
    const commitmentId = move.id.replace("commitment:", "")
    setBusyId(move.id)
    try {
      const response = await fetch(`/api/commitments/${commitmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      })
      if (!response.ok) throw new Error("Could not undo")
      setMoves((current) => [move, ...current])
      router.refresh()
    } catch {
      setError("Could not restore that action")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="next-moves-heading" className="space-y-4">
      {showHeader && (
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--copper-text)]">Raise momentum</p>
            <h2 id="next-moves-heading" className="mt-1 text-2xl font-normal">{limit === null ? "All Moves" : "Next 3 Moves"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{limit === null ? "Ranked by urgency and what you promised." : "The highest-value actions to keep your round moving."}</p>
          </div>
          {limit !== null && moves.length > limit && (
            <Button variant="ghost" size="sm" className="min-h-11" asChild>
              <Link href="/moves">View all <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      {undoMove && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span>Action completed.</span>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={undoCompletion}>
            <Undo2 className="mr-2 h-4 w-4" /> Undo
          </Button>
        </div>
      )}

      {visibleMoves.length === 0 ? (
        <Card className="border-[var(--copper)]/20 shadow-refined">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--copper)]/10">
              <Sparkles className="h-5 w-5 text-[var(--copper-text)]" />
            </div>
            <h3 className="text-lg font-medium">Capture a conversation to find your next move</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Paste your investor notes. Savvo will extract promises and a follow-up for you to approve.
            </p>
            <Button className="mt-5 min-h-11 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] border-0" asChild>
              <Link href="/capture">Capture meeting</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visibleMoves.map((move, index) => {
            const Icon = moveIcon(move.kind)
            const isCommitment = move.kind === "commitment" || move.kind === "waiting"
            return (
              <Card key={move.id} className="shadow-refined overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--copper)]/10 text-[var(--copper-text)]">
                      {index < 3 ? <span className="text-sm font-semibold">{index + 1}</span> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base font-semibold leading-snug">{move.title}</CardTitle>
                      <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">{move.reason}</p>
                      {(move.contactName || move.company) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[move.contactName, move.company].filter(Boolean).join(" at ")}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2 pt-2 sm:pl-14">
                  {move.kind === "review" ? (
                    <Button size="sm" asChild className="min-h-11 bg-[var(--copper)] hover:bg-[var(--copper)]/90">
                      <Link href={move.href} onClick={() => captureEvent("review_opened_from_moves")}>Review now</Link>
                    </Button>
                  ) : move.kind === "intro" ? (
                    <Button size="sm" className="min-h-11" asChild>
                      <Link href={move.href}>Open introduction <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                  ) : isCommitment ? (
                    <>
                      <Button
                        size="sm"
                        className="min-h-11"
                        onClick={() => updateCommitment(move, { status: "completed" })}
                        disabled={busyId === move.id}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {move.kind === "waiting" ? "Mark received" : "Done"}
                      </Button>
                      <Button variant="outline" size="sm" className="min-h-11" onClick={() => setSnoozeId(snoozeId === move.id ? null : move.id)} aria-expanded={snoozeId === move.id}>
                        <Clock3 className="mr-2 h-4 w-4" /> Snooze
                      </Button>
                      {move.contactId && (
                        <Button variant="ghost" size="sm" className="min-h-11" asChild>
                          <Link href={move.href}>Open contact</Link>
                        </Button>
                      )}
                      {snoozeId === move.id && (
                        <div className="basis-full flex flex-wrap gap-2 pt-1" aria-label="Snooze options">
                          {[{ label: "3 days", days: 3 }, { label: "1 week", days: 7 }, { label: "2 weeks", days: 14 }].map((option) => (
                            <Button
                              key={option.days}
                              variant="ghost"
                              size="sm"
                              className="min-h-11"
                              onClick={() => updateCommitment(move, { status: "snoozed", snoozed_until: isoDaysFromNow(option.days) })}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Button size="sm" className="min-h-11" asChild>
                      <Link href={move.href}>Open contact <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
