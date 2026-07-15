"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Loader2, Search, Merge, X, Check, ChevronDown, Sparkles } from "lucide-react"

interface DuplicateContact {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  website: string | null
  last_contact_date: string | null
  created_at: string
  source: string
}

type ConfidenceTier = "high" | "medium" | "low"

interface DuplicateGroup {
  contacts: DuplicateContact[]
  reason: string
  score: number
  tier: ConfidenceTier
}

const FIELD_DEFS: Array<{ key: keyof DuplicateContact; label: string }> = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "job_title", label: "Title" },
  { key: "website", label: "Website" },
  { key: "last_contact_date", label: "Last contact" },
]

const EMPTY_FIELD_VALUE = "Not provided"

const TIER_STYLES: Record<ConfidenceTier, { label: string; badge: string; dot: string }> = {
  high: {
    label: "High confidence",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50",
    dot: "bg-emerald-500",
  },
  medium: {
    label: "Likely match",
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50",
    dot: "bg-amber-500",
  },
  low: {
    label: "Possible match",
    badge:
      "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700",
    dot: "bg-stone-400",
  },
}

function formatFieldValue(c: DuplicateContact, key: keyof DuplicateContact): string {
  const v = c[key]
  if (v == null || v === "") return EMPTY_FIELD_VALUE
  if (key === "last_contact_date" || key === "created_at") {
    try {
      return new Date(v as string).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return String(v)
    }
  }
  return String(v)
}

function completenessScore(c: DuplicateContact): number {
  let score = 0
  for (const { key } of FIELD_DEFS) {
    if (c[key]) score += 1
  }
  if (c.last_contact_date) score += 1
  return score
}

function pickWinner(contacts: DuplicateContact[]): string {
  const sorted = [...contacts].sort((a, b) => {
    const ca = completenessScore(a)
    const cb = completenessScore(b)
    if (ca !== cb) return cb - ca
    const da = a.last_contact_date ? new Date(a.last_contact_date).getTime() : 0
    const db = b.last_contact_date ? new Date(b.last_contact_date).getTime() : 0
    if (da !== db) return db - da
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  return sorted[0].id
}

function mergedPreview(
  winner: DuplicateContact,
  others: DuplicateContact[]
): Partial<Record<keyof DuplicateContact, string>> {
  const preview: Partial<Record<keyof DuplicateContact, string>> = {}
  for (const { key } of FIELD_DEFS) {
    const winnerVal = winner[key]
    if (winnerVal) {
      preview[key] = String(winnerVal)
      continue
    }
    for (const o of others) {
      if (o[key]) {
        preview[key] = String(o[key])
        break
      }
    }
  }
  return preview
}

export function DuplicateReview() {
  const { addToast } = useToast()
  const router = useRouter()
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [busyGroupIdx, setBusyGroupIdx] = useState<number | null>(null)
  const [selectedWinner, setSelectedWinner] = useState<Record<number, string>>({})
  const [expandedPreview, setExpandedPreview] = useState<Record<number, boolean>>({})
  const [bulkBusy, setBulkBusy] = useState(false)

  const highConfidencePairs = useMemo(
    () => groups.filter((g) => g.tier === "high" && g.contacts.length === 2),
    [groups]
  )

  async function scan() {
    setIsScanning(true)
    try {
      const res = await fetch("/api/contacts/duplicates")
      if (!res.ok) throw new Error("Failed to scan")
      const data = await res.json()
      const incoming = (data.groups || []) as DuplicateGroup[]
      setGroups(incoming)
      setHasScanned(true)
      const initialWinners: Record<number, string> = {}
      incoming.forEach((g, i) => {
        initialWinners[i] = pickWinner(g.contacts)
      })
      setSelectedWinner(initialWinners)
      if (incoming.length === 0) {
        addToast({
          title: "No duplicates found",
          description: "Your contacts look clean.",
        })
      }
    } catch {
      addToast({
        title: "Scan didn't finish",
        description: "Refresh the page and try again.",
        variant: "destructive",
      })
    } finally {
      setIsScanning(false)
    }
  }

  async function undoMerge(mergeLogId: string) {
    try {
      const res = await fetch("/api/contacts/merge/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mergeLogId }),
      })
      if (!res.ok) throw new Error("Undo failed")
      addToast({ title: "Merge undone", description: "Both contacts are back as separate records." })
      router.refresh()
      scan()
    } catch {
      addToast({
        title: "Couldn't undo",
        description: "This merge has already been undone or removed.",
        variant: "destructive",
      })
    }
  }

  async function mergeGroup(groupIndex: number) {
    const group = groups[groupIndex]
    const winnerId = selectedWinner[groupIndex] ?? pickWinner(group.contacts)
    const losers = group.contacts.filter((c) => c.id !== winnerId)
    if (losers.length === 0) return

    setBusyGroupIdx(groupIndex)
    try {
      const body =
        losers.length === 1
          ? { keepId: winnerId, removeId: losers[0].id }
          : { pairs: losers.map((l) => ({ keepId: winnerId, removeId: l.id })) }

      const res = await fetch("/api/contacts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to merge")
      }
      const data = await res.json()
      const firstLogId =
        losers.length === 1
          ? (data.mergeLogId as string)
          : (data.merged?.[0]?.mergeLogId as string)

      setGroups((prev) => prev.filter((_, i) => i !== groupIndex))
      addToast({
        title: losers.length === 1 ? "Merged" : `Merged ${losers.length + 1} contacts`,
        description: "All notes, meetings, and tags now live on the kept contact.",
        action: firstLogId
          ? { label: "Undo", onClick: () => undoMerge(firstLogId) }
          : undefined,
      })
      router.refresh()
    } catch (error) {
      addToast({
        title: "Couldn't merge",
        description: error instanceof Error ? error.message : "Refresh and try again.",
        variant: "destructive",
      })
    } finally {
      setBusyGroupIdx(null)
    }
  }

  async function dismissGroup(groupIndex: number) {
    const group = groups[groupIndex]
    try {
      await fetch("/api/contacts/duplicates/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: group.contacts.map((c) => c.id) }),
      })
      setGroups((prev) => prev.filter((_, i) => i !== groupIndex))
    } catch {
      addToast({
        title: "Couldn't save your choice",
        description: "Refresh and try again.",
        variant: "destructive",
      })
    }
  }

  async function mergeAllHighConfidence() {
    if (highConfidencePairs.length === 0) return
    setBulkBusy(true)
    try {
      const pairs = highConfidencePairs.map((g) => {
        const winnerId = pickWinner(g.contacts)
        const loser = g.contacts.find((c) => c.id !== winnerId)!
        return { keepId: winnerId, removeId: loser.id }
      })
      const res = await fetch("/api/contacts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs }),
      })
      if (!res.ok) throw new Error("Bulk merge failed")
      const data = await res.json()
      const successCount = data.merged?.length ?? 0
      setGroups((prev) => prev.filter((g) => !(g.tier === "high" && g.contacts.length === 2)))
      addToast({
        title: `Merged ${successCount} high-confidence duplicates`,
        description: "Activities and tags combined for each.",
      })
      router.refresh()
    } catch {
      addToast({
        title: "Bulk merge didn't finish",
        description: "Some merges may have completed. Refresh to see the current state.",
        variant: "destructive",
      })
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <Card className="shadow-refined">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-normal">
          <Merge className="h-4 w-4 text-muted-foreground" />
          Duplicate Contacts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasScanned ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scan your contacts for potential duplicates. Review matches side-by-side and merge with one click.
            </p>
            <Button variant="outline" onClick={scan} disabled={isScanning}>
              {isScanning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              {isScanning ? "Scanning..." : "Scan for Duplicates"}
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-emerald-500" />
            No duplicates found.
            <button
              onClick={scan}
              className="text-[var(--copper)] hover:underline text-xs font-medium ml-1"
            >
              Scan again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {groups.length} potential duplicate{groups.length !== 1 ? "s" : ""} found.
              </p>
              {highConfidencePairs.length >= 2 && (
                <Button
                  size="sm"
                  onClick={mergeAllHighConfidence}
                  disabled={bulkBusy}
                  className="h-8 text-xs"
                >
                  {bulkBusy ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3 w-3" />
                  )}
                  Merge {highConfidencePairs.length} high-confidence
                </Button>
              )}
            </div>
            {groups.map((group, gi) => {
              const winnerId = selectedWinner[gi] ?? group.contacts[0].id
              const winner = group.contacts.find((c) => c.id === winnerId) ?? group.contacts[0]
              const others = group.contacts.filter((c) => c.id !== winnerId)
              const tier = TIER_STYLES[group.tier]
              const preview = mergedPreview(winner, others)

              return (
                <div
                  key={gi}
                  className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${tier.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
                        {tier.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{group.reason}</span>
                    </div>
                    <button
                      onClick={() => dismissGroup(gi)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      title="Not a duplicate. Don't show this pair again"
                    >
                      <X className="h-3.5 w-3.5" />
                      Not a duplicate
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.contacts.map((c) => {
                      const isWinner = c.id === winnerId
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() =>
                            setSelectedWinner((prev) => ({ ...prev, [gi]: c.id }))
                          }
                          className={`text-left rounded-lg border p-3 transition-all ${
                            isWinner
                              ? "border-[var(--copper)] ring-1 ring-[var(--copper)]/30 bg-stone-50 dark:bg-stone-800/50"
                              : "border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {isWinner ? "Keeping" : "Merge into above"}
                            </span>
                            {isWinner && (
                              <Check className="h-3.5 w-3.5 text-[var(--copper)]" />
                            )}
                          </div>
                          <dl className="space-y-1.5">
                            {FIELD_DEFS.map(({ key, label }) => {
                              const val = formatFieldValue(c, key)
                              const isDifferent = group.contacts.some(
                                (other) =>
                                  other.id !== c.id &&
                                  formatFieldValue(other, key) !== val &&
                                  formatFieldValue(other, key) !== EMPTY_FIELD_VALUE &&
                                  val !== EMPTY_FIELD_VALUE
                              )
                              return (
                                <div
                                  key={String(key)}
                                  className="flex items-start gap-2 text-xs"
                                >
                                  <dt className="w-20 shrink-0 text-muted-foreground">
                                    {label}
                                  </dt>
                                  <dd
                                    className={`flex-1 truncate ${
                                      isDifferent && val !== EMPTY_FIELD_VALUE
                                        ? "text-foreground font-medium"
                                        : "text-stone-700 dark:text-stone-300"
                                    }`}
                                  >
                                    {val}
                                    {isDifferent && val !== EMPTY_FIELD_VALUE && (
                                      <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-[var(--copper)] align-middle" />
                                    )}
                                  </dd>
                                </div>
                              )
                            })}
                          </dl>
                        </button>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPreview((prev) => ({ ...prev, [gi]: !prev[gi] }))
                    }
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        expandedPreview[gi] ? "rotate-180" : ""
                      }`}
                    />
                    {expandedPreview[gi] ? "Hide" : "Preview"} merged result
                  </button>

                  {expandedPreview[gi] && (
                    <div className="rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                        After merge
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {FIELD_DEFS.map(({ key, label }) => {
                          const val = preview[key] ?? EMPTY_FIELD_VALUE
                          return (
                            <div
                              key={String(key)}
                              className="flex items-start gap-2 text-xs"
                            >
                              <dt className="w-20 shrink-0 text-muted-foreground">
                                {label}
                              </dt>
                              <dd className="flex-1 truncate text-stone-700 dark:text-stone-300">
                                {val}
                              </dd>
                            </div>
                          )
                        })}
                      </dl>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => mergeGroup(gi)}
                      disabled={busyGroupIdx === gi}
                      className="h-8 text-xs"
                    >
                      {busyGroupIdx === gi ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Merge className="mr-1.5 h-3 w-3" />
                      )}
                      Merge {group.contacts.length > 2 ? `all ${group.contacts.length}` : ""}
                    </Button>
                  </div>
                </div>
              )
            })}
            <button
              onClick={scan}
              className="text-xs text-muted-foreground hover:text-[var(--copper)]"
            >
              Rescan
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
