"use client"

import { useEffect, useState } from "react"
import { Check, Clipboard, Loader2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { captureEvent } from "@/components/posthog-provider"
import { RaiseFunnel } from "@/components/raise-funnel"
import { summarizeStages } from "@/lib/investor-stage"

interface SnapshotState {
  snapshot: { url: string; title: string | null } | null
  stages: Record<string, number>
}

export function RaiseSnapshotCard() {
  const { addToast } = useToast()
  const [state, setState] = useState<SnapshotState | null>(null)
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState<"save" | "delete" | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/raise-snapshot")
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error)
        if (cancelled) return
        setState(body)
        setTitle(body.snapshot?.title ?? "")
      })
      .catch(() => {
        if (!cancelled) setState({ snapshot: null, stages: {} })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    setBusy("save")
    try {
      const response = await fetch("/api/raise-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || null }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      if (!state?.snapshot) captureEvent("raise_snapshot_created")
      setState((prev) => ({ stages: prev?.stages ?? {}, snapshot: body.snapshot }))
      addToast({ title: state?.snapshot ? "Title saved" : "Share link created" })
    } catch (error) {
      addToast({
        title: "Couldn't save snapshot",
        description: error instanceof Error && error.message ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setBusy(null)
    }
  }

  async function turnOff() {
    if (!window.confirm("Turn off this link? Anyone who has it will see a not-found page.")) return
    setBusy("delete")
    try {
      const response = await fetch("/api/raise-snapshot", { method: "DELETE" })
      if (!response.ok) throw new Error()
      setState((prev) => ({ stages: prev?.stages ?? {}, snapshot: null }))
      addToast({ title: "Link turned off" })
    } catch {
      addToast({ title: "Couldn't turn off the link", description: "Try again in a moment.", variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  async function copyLink() {
    if (!state?.snapshot) return
    try {
      await navigator.clipboard.writeText(state.snapshot.url)
      setCopied(true)
      captureEvent("raise_snapshot_link_copied")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked; the URL stays visible and selectable.
    }
  }

  const summary = summarizeStages(state?.stages)
  const hasStages = summary.active + summary.passed > 0

  return (
    <Card id="raise-snapshot" className="shadow-refined scroll-mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-normal">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          Raise snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-stone-700 dark:text-stone-300">
          A private link that shows co-founders and advisors where your raise stands: counts by stage, never investor names.
        </p>

        {!state ? (
          <div className="h-32 rounded-lg bg-muted animate-pulse" role="status" aria-label="Loading raise snapshot" />
        ) : (
          <>
            {hasStages ? (
              <RaiseFunnel stages={state.stages} />
            ) : (
              <p className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
                Set a raise stage on your investors (on each contact, or import a tracker with a Status column) to fill this in.
              </p>
            )}

            <div className="space-y-2">
              <label htmlFor="raise-snapshot-title" className="text-sm font-medium text-stone-900 dark:text-stone-100">
                Title <span className="font-normal text-stone-700 dark:text-stone-300">(optional)</span>
              </label>
              <Input
                id="raise-snapshot-title"
                value={title}
                maxLength={80}
                placeholder="Acme seed round"
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-11"
              />
            </div>

            {state.snapshot ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-stone-50 px-3 py-2.5 text-sm text-stone-900 dark:bg-stone-950 dark:text-stone-100">
                    {state.snapshot.url}
                  </code>
                  <Button type="button" variant="outline" className="min-h-11" onClick={copyLink}>
                    {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Clipboard className="mr-2 h-4 w-4" />}
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={save}
                    disabled={busy !== null || title.trim() === (state.snapshot.title ?? "")}
                  >
                    {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save title
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={turnOff} disabled={busy !== null}>
                    {busy === "delete" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Turn off link
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" className="min-h-11" onClick={save} disabled={busy !== null}>
                {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create share link
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
