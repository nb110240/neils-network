"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Clock3, Inbox, Sparkles, Undo2, UserRoundCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { HealthBadge } from "@/components/health-badge"
import { DraftMessageButton } from "@/components/draft-message-button"
import { captureEvent } from "@/components/posthog-provider"
import { getInitials } from "@/lib/utils"
import { DASHBOARD_MOVE_LIMIT, type NextMove } from "@/lib/next-moves"

const SNOOZE_OPTIONS = [
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
]

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function MoveIcon({ kind }: { kind: NextMove["kind"] }) {
  const className = "h-4 w-4"
  if (kind === "review") return <Inbox className={className} />
  if (kind === "waiting") return <UserRoundCheck className={className} />
  if (kind === "commitment") return <Check className={className} />
  if (kind === "intro") return <Users className={className} />
  return <Clock3 className={className} />
}

/** Generic "Follow up with Avery" titles repeat the name; only show real next steps. */
function hasDistinctTitle(move: NextMove): boolean {
  if (!move.contactName) return false
  if (move.kind !== "follow_up") return true
  return !move.title.endsWith(move.contactName)
}

export interface NextMovesProps {
  moves: NextMove[]
  /** Rows to show before "View all"; null shows everything. */
  limit?: number | null
  /** Enables the draft-message action on contact rows. */
  plan?: string
  heading?: string
  description?: string
  showHeader?: boolean
  viewAllHref?: string
  emptyTitle?: string
  emptyDescription?: string
}

export function NextMoves({
  moves: initialMoves,
  limit = DASHBOARD_MOVE_LIMIT,
  plan,
  heading = "Next moves",
  description = "Promises, follow-ups, and people drifting, in the order they matter.",
  showHeader = true,
  viewAllHref = "/moves",
  emptyTitle = "Nothing needs you right now",
  emptyDescription = "When a promise comes due or someone starts drifting, it shows up here.",
}: NextMovesProps) {
  const router = useRouter()
  const [moves, setMoves] = useState(initialMoves)
  const [sourceMoves, setSourceMoves] = useState(initialMoves)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [undoMove, setUndoMove] = useState<NextMove | null>(null)
  const [snoozeId, setSnoozeId] = useState<string | null>(null)

  // Fresh server data (after router.refresh) replaces local optimistic state.
  if (initialMoves !== sourceMoves) {
    setSourceMoves(initialMoves)
    setMoves(initialMoves)
  }

  const visibleMoves = limit === null ? moves : moves.slice(0, limit)
  const hiddenCount = moves.length - visibleMoves.length

  /** Optimistically drop a row, then persist; put it back if the request fails. */
  async function resolveMove(move: NextMove, request: () => Promise<Response>, fallbackError: string) {
    const index = moves.findIndex((candidate) => candidate.id === move.id)
    setMoves((current) => current.filter((candidate) => candidate.id !== move.id))
    setSnoozeId(null)
    setBusyId(move.id)
    setError(null)
    try {
      const response = await request()
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || fallbackError)
      }
      router.refresh()
      return true
    } catch (requestError) {
      setMoves((current) => {
        if (current.some((candidate) => candidate.id === move.id)) return current
        const next = [...current]
        next.splice(Math.max(0, index), 0, move)
        return next
      })
      setError(requestError instanceof Error ? requestError.message : fallbackError)
      return false
    } finally {
      setBusyId(null)
    }
  }

  function patchCommitment(move: NextMove, body: Record<string, unknown>) {
    const commitmentId = move.id.replace("commitment:", "")
    return fetch(`/api/commitments/${commitmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  async function completeCommitment(move: NextMove) {
    const ok = await resolveMove(move, () => patchCommitment(move, { status: "completed" }), "Could not update this action")
    if (ok) {
      setUndoMove(move)
      captureEvent("commitment_completed", { direction: move.kind === "waiting" ? "contact_owes" : "user_owes" })
    }
  }

  async function snoozeMove(move: NextMove, days: number) {
    if (move.kind === "follow_up" && move.contactId) {
      const contactId = move.contactId
      await resolveMove(move, () => fetch(`/api/contacts/${contactId}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      }), "Could not snooze this contact")
      return
    }
    const ok = await resolveMove(move, () => patchCommitment(move, { status: "snoozed", snoozed_until: isoDaysFromNow(days) }), "Could not snooze this action")
    if (ok) captureEvent("commitment_snoozed")
  }

  async function undoCompletion() {
    if (!undoMove) return
    const move = undoMove
    setUndoMove(null)
    setMoves((current) => [move, ...current])
    try {
      const response = await patchCommitment(move, { status: "open" })
      if (!response.ok) throw new Error("Could not undo")
      router.refresh()
    } catch {
      setMoves((current) => current.filter((candidate) => candidate.id !== move.id))
      setError("Could not restore that action")
    }
  }

  return (
    <section aria-labelledby={showHeader ? "next-moves-heading" : undefined} className="space-y-4" data-tour="next-moves">
      {showHeader && (
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="next-moves-heading" className="flex items-center gap-3 text-2xl font-normal">
              {heading}
              {moves.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-[var(--copper)] px-2.5 py-0.5 font-sans text-xs font-semibold text-white">
                  {moves.length}
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {hiddenCount > 0 && (
            <Button variant="ghost" size="sm" className="min-h-11 shrink-0 text-muted-foreground hover:text-[var(--copper-text)]" asChild>
              <Link href={viewAllHref}>View all <ArrowRight className="ml-2 h-4 w-4" /></Link>
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

      <Card className="shadow-refined border-l-2 border-l-[var(--copper)] overflow-hidden">
        {visibleMoves.length === 0 ? (
          <CardContent className="flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--copper)]/10">
              <Sparkles className="h-5 w-5 text-[var(--copper-text)]" />
            </div>
            <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">{emptyTitle}</h3>
            <p className="mt-2 max-w-md text-sm text-stone-700 dark:text-stone-300">{emptyDescription}</p>
            <Button variant="outline" className="mt-5 min-h-11 border-[var(--copper)]/30 text-[var(--copper-text)] hover:bg-[var(--copper)]/5" asChild>
              <Link href="/capture">Capture a meeting</Link>
            </Button>
          </CardContent>
        ) : (
          <CardContent className="p-2 sm:p-3">
            <ul className="divide-y divide-stone-200 dark:divide-stone-700/60 stagger-children">
              {visibleMoves.map((move) => (
                <MoveRow
                  key={move.id}
                  move={move}
                  plan={plan}
                  busy={busyId === move.id}
                  snoozeOpen={snoozeId === move.id}
                  onToggleSnooze={() => setSnoozeId(snoozeId === move.id ? null : move.id)}
                  onSnooze={(days) => snoozeMove(move, days)}
                  onComplete={() => completeCommitment(move)}
                />
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </section>
  )
}

function MoveRow({
  move,
  plan,
  busy,
  snoozeOpen,
  onToggleSnooze,
  onSnooze,
  onComplete,
}: {
  move: NextMove
  plan?: string
  busy: boolean
  snoozeOpen: boolean
  onToggleSnooze: () => void
  onSnooze: (days: number) => void
  onComplete: () => void
}) {
  const isCommitment = move.kind === "commitment" || move.kind === "waiting"
  const canSnooze = isCommitment || (move.kind === "follow_up" && !!move.contactId)
  const primary = move.contactName || move.title
  const showTitle = hasDistinctTitle(move)

  return (
    <li className="group">
      <div className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[var(--copper)]/5">
        <Link
          href={move.href}
          className="flex min-w-0 flex-1 items-center gap-3"
          onClick={move.kind === "review" ? () => captureEvent("review_opened_from_moves") : undefined}
        >
          {move.contactName ? (
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-[var(--copper)]/10 text-xs font-medium text-[var(--copper-text)]">
                {getInitials(move.contactName)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--copper)]/10 text-[var(--copper-text)]">
              <MoveIcon kind={move.kind} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate font-medium text-stone-900 transition-colors group-hover:text-[var(--copper-text)] dark:text-stone-100">
                {primary}
              </span>
              {move.contactName && move.company && (
                <span className="hidden truncate text-sm text-muted-foreground sm:inline">{move.company}</span>
              )}
            </div>
            {showTitle && (
              <p className="truncate text-sm text-stone-700 dark:text-stone-300">{move.title}</p>
            )}
            <div className="mt-0.5 flex items-center gap-2">
              {move.health && move.kind === "follow_up" && <HealthBadge health={move.health} />}
              <span className="truncate text-xs text-muted-foreground">{move.reason}</span>
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          {move.kind === "review" && (
            <Button size="sm" asChild className="min-h-11 sm:min-h-9 bg-[var(--copper)] hover:bg-[var(--copper)]/90">
              <Link href={move.href} onClick={() => captureEvent("review_opened_from_moves")}>Review</Link>
            </Button>
          )}
          {isCommitment && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9"
              onClick={onComplete}
              disabled={busy}
              aria-label={move.kind === "waiting" ? "Mark received" : "Mark done"}
              title={move.kind === "waiting" ? "Mark received" : "Mark done"}
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          {canSnooze && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground"
              onClick={onToggleSnooze}
              disabled={busy}
              aria-expanded={snoozeOpen}
              aria-label="Snooze"
              title="Snooze"
            >
              <Clock3 className="h-4 w-4" />
            </Button>
          )}
          {move.kind === "follow_up" && move.contactId && plan && (
            <DraftMessageButton
              contactId={move.contactId}
              contactName={move.contactName || "Contact"}
              plan={plan}
              variant="icon"
            />
          )}
          {move.kind === "intro" && (
            <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" asChild>
              <Link href={move.href} aria-label="Open introduction"><ArrowRight className="h-4 w-4" /></Link>
            </Button>
          )}
        </div>
      </div>

      {snoozeOpen && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-3 sm:pl-14" aria-label="Snooze options">
          <span className="text-xs text-muted-foreground">Snooze for</span>
          {SNOOZE_OPTIONS.map((option) => (
            <Button
              key={option.days}
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8"
              disabled={busy}
              onClick={() => onSnooze(option.days)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </li>
  )
}
