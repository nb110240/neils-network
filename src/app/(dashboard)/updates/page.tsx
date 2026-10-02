"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Clipboard, Lock, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { captureEvent } from "@/components/posthog-provider"
import { RaiseFunnel } from "@/components/raise-funnel"
import { cn } from "@/lib/utils"
import type { InvestorUpdateStats } from "@/lib/investor-update"
import { readInvestorUpdateResponse } from "@/lib/investor-update-response"

type Tone = "concise" | "detailed"

const PERIODS = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 2 weeks" },
  { value: 30, label: "Last 30 days" },
  { value: 60, label: "Last 60 days" },
  { value: 90, label: "Last 90 days" },
]

const TONES: Array<{ value: Tone; label: string }> = [
  { value: "concise", label: "Concise" },
  { value: "detailed", label: "Detailed" },
]

export default function InvestorUpdatesPage() {
  const { addToast } = useToast()
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [periodDays, setPeriodDays] = useState(30)
  const [highlights, setHighlights] = useState("")
  const [asks, setAsks] = useState("")
  const [tone, setTone] = useState<Tone>("concise")
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState("")
  const [stats, setStats] = useState<InvestorUpdateStats | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/subscription")
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!cancelled) setIsPro(!(response.ok && body.plan === "free"))
      })
      .catch(() => {
        // The API enforces the plan; let the form render and surface its error.
        if (!cancelled) setIsPro(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function generate() {
    setDrafting(true)
    try {
      const response = await fetch("/api/investor-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_days: periodDays,
          tone,
          ...(highlights.trim() ? { highlights: highlights.trim() } : {}),
          ...(asks.trim() ? { asks: asks.trim() } : {}),
        }),
      })
      const result = await readInvestorUpdateResponse(response)
      if (result.kind === "upgrade") {
        setIsPro(false)
        return
      }
      if (result.kind === "error") throw new Error(result.message)
      const body = result.body
      setDraft(String(body.draft ?? ""))
      setStats(body.stats as InvestorUpdateStats)
      setCopied(false)
      captureEvent("investor_update_drafted", { period_days: periodDays, tone, fallback: Boolean(body.fallback) })
    } catch (error) {
      addToast({
        title: "Couldn't draft your update",
        description: error instanceof Error && error.message ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setDrafting(false)
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      captureEvent("investor_update_copied", { period_days: periodDays, tone })
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast({ title: "Copy blocked", description: "Select the text and copy it manually.", variant: "destructive" })
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="animate-fade-in">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--copper-text)]">Investor update</p>
        <h1 className="mt-1 text-3xl font-normal tracking-tight text-stone-900 dark:text-stone-100 sm:text-4xl">Draft this month&apos;s update</h1>
        <p className="mt-2 max-w-2xl text-base text-stone-700 dark:text-stone-300">
          Savvo pulls your pipeline, meetings, and follow-ups into a first draft. Add your wins and asks, then edit and send it yourself.
        </p>
      </div>

      {isPro === null ? (
        <Skeleton className="h-64 w-full rounded-xl" role="status" aria-label="Loading" />
      ) : !isPro ? (
        <Card className="shadow-refined">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-normal">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Investor updates are a Pro feature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-900 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-stone-700 dark:text-stone-300">
                Turn your raise into a ready-to-send monthly update, built from the pipeline you already track.
              </p>
              <Button size="sm" className="min-h-11 shrink-0" asChild><Link href="/pricing">Upgrade to Pro</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="shadow-refined h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-normal">
                <Mail className="h-4 w-4 text-[var(--copper-text)]" />
                What to include
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void generate()
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="update-period">Period</Label>
                  <select
                    id="update-period"
                    value={periodDays}
                    onChange={(event) => setPeriodDays(Number(event.target.value))}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-stone-900 dark:text-stone-100"
                  >
                    {PERIODS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="update-highlights">
                    Highlights <span className="font-normal text-stone-700 dark:text-stone-300">(optional)</span>
                  </Label>
                  <Textarea
                    id="update-highlights"
                    value={highlights}
                    maxLength={2000}
                    rows={5}
                    placeholder={"Hit $50k MRR\nShipped the mobile app\nHired our first engineer"}
                    onChange={(event) => setHighlights(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="update-asks">
                    Asks <span className="font-normal text-stone-700 dark:text-stone-300">(optional)</span>
                  </Label>
                  <Textarea
                    id="update-asks"
                    value={asks}
                    maxLength={1000}
                    rows={3}
                    placeholder="Intros to fintech angels, a senior designer"
                    onChange={(event) => setAsks(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <span id="update-tone-label" className="text-sm font-medium text-stone-900 dark:text-stone-100">Tone</span>
                  <div role="group" aria-labelledby="update-tone-label" className="inline-flex w-full rounded-lg border border-stone-200 bg-stone-50 p-1 dark:border-stone-700 dark:bg-stone-900">
                    {TONES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={tone === t.value}
                        onClick={() => setTone(t.value)}
                        className={cn(
                          "min-h-9 flex-1 rounded-md px-3 text-sm transition-colors",
                          tone === t.value
                            ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100"
                            : "text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="min-h-11 w-full" disabled={drafting}>
                  {draft ? "Redraft update" : "Draft update"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-refined">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-lg font-normal">Your draft</CardTitle>
                {draft && !drafting && (
                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={copyDraft}>
                    {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Clipboard className="mr-2 h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {drafting ? (
                  <div className="space-y-3" role="status" aria-label="Drafting">
                    {["w-1/4", "w-full", "w-5/6", "w-1/3", "w-full", "w-2/3", "w-1/4", "w-11/12"].map((width, i) => (
                      <Skeleton key={i} className={cn("h-4", width)} />
                    ))}
                  </div>
                ) : draft ? (
                  <>
                    <Label htmlFor="update-draft" className="sr-only">Investor update draft</Label>
                    <Textarea
                      id="update-draft"
                      value={draft}
                      rows={18}
                      onChange={(event) => setDraft(event.target.value)}
                      className="font-sans text-sm leading-relaxed text-stone-900 dark:text-stone-100"
                    />
                  </>
                ) : (
                  <p className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
                    Your update appears here, ready to edit. Fundraising numbers come from your pipeline; investor names stay out unless you mention them.
                  </p>
                )}
              </CardContent>
            </Card>

            {stats && !drafting && (
              <Card className="shadow-refined animate-fade-in">
                <CardHeader>
                  <CardTitle className="text-lg font-normal">Numbers used</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RaiseFunnel stages={stats.stages} />
                  <ul className="grid gap-2 text-sm text-stone-700 dark:text-stone-300 sm:grid-cols-2">
                    <li><span className="tabular-nums text-stone-900 dark:text-stone-100">{stats.meetings.count}</span> investor meetings</li>
                    <li><span className="tabular-nums text-stone-900 dark:text-stone-100">{stats.commitments.completed}</span> follow-ups completed</li>
                    <li><span className="tabular-nums text-stone-900 dark:text-stone-100">{stats.commitments.open_due_soon}</span> follow-ups due soon</li>
                    <li><span className="tabular-nums text-stone-900 dark:text-stone-100">{stats.intros.introduced}</span> warm intros made</li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
