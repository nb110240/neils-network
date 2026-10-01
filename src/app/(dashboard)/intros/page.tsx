"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Link2,
  Loader2,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { captureEvent } from "@/components/posthog-provider"
import type { IntroPathConfidence, IntroRequest, IntroRequestStatus } from "@/lib/types"

interface ContactOption {
  id: string
  name: string | null
  company: string | null
  job_title: string | null
}

interface IntroPath {
  connector: ContactOption
  score: number
  confidence: IntroPathConfidence
  evidence: string
  reason: string
}

interface IntroSuggestion {
  contact1_id: string
  contact2_id: string
  contact1_name: string
  contact2_name: string
  contact1_company: string | null
  contact2_company: string | null
  reason: string
  intro_template: string
}

const STATUS_LABELS: Record<IntroRequestStatus, string> = {
  draft: "Draft",
  requested: "Asked connector",
  accepted: "Connector agreed",
  introduced: "Introduction made",
  meeting_booked: "Meeting booked",
  closed: "Closed",
  declined: "Declined",
}

function confidenceLabel(value: IntroPathConfidence) {
  if (value === "verified") return "CRM evidence"
  if (value === "possible") return "Confirm relationship"
  return "Context fit only"
}

export default function IntrosPage() {
  const { addToast } = useToast()
  const [requests, setRequests] = useState<IntroRequest[]>([])
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [targetId, setTargetId] = useState("")
  const [paths, setPaths] = useState<IntroPath[]>([])
  const [whyNow, setWhyNow] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [finding, setFinding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const contactMap = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts])

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch("/api/intro-requests")
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not load warm introductions")
      setRequests(body.requests || [])
      setContacts(body.contacts || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again"
      setLoadError(message)
      addToast({
        title: "Could not load introductions",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const findPaths = async (id: string) => {
    setTargetId(id)
    setPaths([])
    if (!id) return
    setFinding(true)
    try {
      const response = await fetch(`/api/intro-requests/paths?target_id=${encodeURIComponent(id)}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not find paths")
      setPaths(body.paths || [])
    } catch (error) {
      addToast({ title: "Could not find intro paths", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" })
    } finally {
      setFinding(false)
    }
  }

  const createRequest = async (path: IntroPath) => {
    if (whyNow.trim().length < 3) return
    setBusyId(path.connector.id)
    try {
      const response = await fetch("/api/intro-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_contact_id: targetId,
          connector_contact_id: path.connector.id,
          reason: whyNow.trim(),
          path_evidence: path.evidence,
          path_confidence: path.confidence,
          strength_score: path.score,
        }),
      })
      const body = await response.json()
      if (response.status === 403) throw new Error("Warm intro tracking is a Pro feature. Upgrade to save this path.")
      if (!response.ok) throw new Error(body.error || "Could not save this path")
      setRequests((current) => [body.request, ...current])
      addToast({ title: "Warm intro path saved", description: "Review the ask below. Savvo will never send it for you." })
    } catch (error) {
      addToast({ title: "Could not save intro path", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const updateRequest = async (request: IntroRequest, patch: Record<string, unknown>) => {
    setBusyId(request.id)
    try {
      const response = await fetch(`/api/intro-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not update introduction")
      setRequests((current) => current.map((item) => item.id === request.id ? body.request : item))
    } catch (error) {
      addToast({ title: "Could not update introduction", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const deleteRequest = async (request: IntroRequest) => {
    if (!window.confirm("Delete this introduction record?")) return
    setBusyId(request.id)
    const response = await fetch(`/api/intro-requests/${request.id}`, { method: "DELETE" })
    if (response.ok) setRequests((current) => current.filter((item) => item.id !== request.id))
    else addToast({ title: "Could not delete introduction", variant: "destructive" })
    setBusyId(null)
  }

  const copyDraft = async (request: IntroRequest) => {
    await navigator.clipboard.writeText(request.draft_message)
    setCopiedId(request.id)
    window.setTimeout(() => setCopiedId(null), 2000)
  }

  // Copies the ask plus a one-click link the connector can answer on, no
  // account needed. Creating the link marks a draft as asked.
  const copyAskWithLink = async (request: IntroRequest) => {
    setBusyId(request.id)
    try {
      const response = await fetch(`/api/intro-requests/${request.id}/share`, { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not create a link")
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, ...body.request } : item))
      captureEvent("intro_link_copied")
      try {
        await navigator.clipboard.writeText(`${request.draft_message}\n\nYou can answer with one click here: ${body.url}`)
        setCopiedId(`${request.id}:link`)
        window.setTimeout(() => setCopiedId(null), 2000)
      } catch {
        // Safari blocks clipboard writes after an await; the link exists, so show it.
        addToast({ title: "Link ready", description: body.url })
      }
    } catch (error) {
      addToast({ title: "Could not copy the link", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="animate-fade-in">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--copper-text)]">Warm introduction engine</p>
        <h1 className="mt-1 text-3xl font-normal tracking-tight sm:text-4xl">Turn warm paths into meetings</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">Find evidence-backed connectors, prepare a respectful ask, and track every handoff. Savvo never sends on your behalf.</p>
      </div>

      <Card className="border-[var(--copper)]/20 shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal"><Search className="h-4 w-4 text-[var(--copper-text)]" /> Find a path to an investor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="intro-target">Who do you want to meet?</Label>
              <select id="intro-target" value={targetId} onChange={(event) => void findPaths(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Choose a target contact</option>
                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name || "Unnamed contact"}{contact.company ? ` at ${contact.company}` : ""}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="why-now">Why is this introduction useful now?</Label>
              <Textarea id="why-now" value={whyNow} onChange={(event) => setWhyNow(event.target.value)} placeholder="We are raising a seed round and their focus on..." rows={3} />
            </div>
          </div>

          {finding ? (
            <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Checking your CRM evidence...</div>
          ) : targetId && paths.length === 0 ? (
            <div className="rounded-xl border bg-stone-50 p-4 text-sm text-stone-700 dark:bg-stone-900/40 dark:text-stone-300">
              No credible warm path is in your CRM yet. Savvo will not invent one. Add relationship notes or shared context, then try again.
            </div>
          ) : paths.length > 0 ? (
            <div className="grid gap-3">
              {paths.map((path, index) => (
                <div key={path.connector.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--copper)]/10 text-xs font-semibold text-[var(--copper-text)]">{index + 1}</span>
                        <Link href={`/contact/${path.connector.id}`} className="font-semibold text-[var(--copper-text)] hover:underline">{path.connector.name || "Unnamed contact"}</Link>
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">{confidenceLabel(path.confidence)}</span>
                      </div>
                      <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">{path.evidence}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{path.reason}</p>
                    </div>
                    <Button size="sm" className="min-h-11" onClick={() => createRequest(path)} disabled={busyId === path.connector.id || whyNow.trim().length < 3}>
                      {busyId === path.connector.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Prepare ask
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> A mention or shared tag is not proof of a relationship. Savvo labels uncertainty so you can verify before asking.</div>
        </CardContent>
      </Card>

      <section aria-labelledby="intro-pipeline-heading" className="space-y-4">
        <div>
          <h2 id="intro-pipeline-heading" className="text-2xl font-normal">Introduction pipeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">Draft → asked → agreed → introduced → meeting booked.</p>
        </div>
        {loading ? (
          <Card><CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading introductions...</CardContent></Card>
        ) : loadError ? (
          <Card><CardContent className="flex flex-col items-center gap-3 py-8 text-center"><p className="text-sm text-red-700 dark:text-red-300">{loadError}</p><Button type="button" variant="outline" size="sm" className="min-h-11" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button></CardContent></Card>
        ) : requests.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No intro requests yet. Choose a target above to begin.</CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => {
              const target = contactMap.get(request.target_contact_id)
              const connector = request.connector_contact_id ? contactMap.get(request.connector_contact_id) : null
              return (
                <Card key={request.id} id={`intro-${request.id}`} className="scroll-mt-24 shadow-refined">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
                          <span>{connector?.name || "Connector"}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /><span>{target?.name || "Target"}</span>
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">{confidenceLabel(request.path_confidence)} · strength {request.strength_score}/100</p>
                      </div>
                      <select aria-label={`Status for ${target?.name || "introduction"}`} value={request.status} onChange={(event) => void updateRequest(request, { status: event.target.value })} disabled={busyId === request.id} className="h-9 rounded-md border bg-background px-2 text-sm">
                        {(Object.keys(STATUS_LABELS) as IntroRequestStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Why now</p>
                      <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">{request.reason}</p>
                      {request.path_evidence && <p className="mt-1 text-xs text-muted-foreground">Evidence: {request.path_evidence}</p>}
                    </div>
                    <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-900/50">
                      <Textarea
                        aria-label={`Draft introduction request to ${connector?.name || "connector"}`}
                        value={request.draft_message}
                        onChange={(event) => setRequests((current) => current.map((item) => item.id === request.id ? { ...item, draft_message: event.target.value } : item))}
                        rows={4}
                        className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {request.connector_contact_id && !request.connector_responded_at && ["draft", "requested"].includes(request.status) && (
                          <Button size="sm" className="min-h-11" onClick={() => copyAskWithLink(request)} disabled={busyId === request.id}><Link2 className="mr-2 h-4 w-4" /> {copiedId === `${request.id}:link` ? "Copied" : "Copy ask with link"}</Button>
                        )}
                        <Button size="sm" variant="outline" className="min-h-11" onClick={() => copyDraft(request)}><Copy className="mr-2 h-4 w-4" /> {copiedId === request.id ? "Copied" : "Copy ask"}</Button>
                        <Button size="sm" variant="outline" className="min-h-11" onClick={() => updateRequest(request, { draft_message: request.draft_message })} disabled={busyId === request.id}>Save edit</Button>
                        {request.status === "draft" && <Button size="sm" variant="outline" className="min-h-11" onClick={() => updateRequest(request, { status: "requested", draft_message: request.draft_message })}>Mark asked</Button>}
                        <Button size="sm" variant="ghost" className="min-h-11 text-red-700 dark:text-red-300" onClick={() => deleteRequest(request)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                      </div>
                    </div>
                    {request.connector_responded_at && (
                      <div className="rounded-xl border border-stone-200 p-3 text-sm dark:border-stone-700">
                        <p className="font-medium text-stone-900 dark:text-stone-100">
                          {connector?.name || "Your connector"} {request.status === "declined" ? "can't make this intro right now" : "said yes"}
                        </p>
                        {request.connector_note && <p className="mt-1 whitespace-pre-wrap text-stone-700 dark:text-stone-300">{request.connector_note}</p>}
                      </div>
                    )}
                    {request.next_follow_up_at && (
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Follow up by {new Date(request.next_follow_up_at).toLocaleDateString()}</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <NetworkSuggestions />
    </div>
  )
}

function NetworkSuggestions() {
  const { addToast } = useToast()
  const [suggestions, setSuggestions] = useState<IntroSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/intros")
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not generate suggestions")
      setSuggestions(body.suggestions || [])
      setMessage(body.message || null)
      setLoaded(true)
    } catch (error) {
      addToast({ title: "Could not generate network suggestions", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby="network-suggestions-heading" className="border-t pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Secondary tool</p>
          <h2 id="network-suggestions-heading" className="mt-1 text-2xl font-normal">Introductions inside your network</h2>
          <p className="mt-1 text-sm text-muted-foreground">Find two existing contacts who may benefit from knowing each other.</p>
        </div>
        <Button variant="outline" className="min-h-11" onClick={generate} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : loaded ? <RefreshCw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}{loaded ? "Refresh" : "Generate"}</Button>
      </div>
      {loaded && (
        <div className="mt-4 grid gap-3">
          {suggestions.length === 0 ? (
            <Card><CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Users className="h-4 w-4" /> {message || "No strong suggestions yet."}</CardContent></Card>
          ) : suggestions.map((suggestion) => (
            <Card key={`${suggestion.contact1_id}:${suggestion.contact2_id}`}>
              <CardContent className="space-y-3 py-5">
                <p className="flex flex-wrap items-center gap-2 font-medium"><Link href={`/contact/${suggestion.contact1_id}`} className="text-[var(--copper-text)] hover:underline">{suggestion.contact1_name}</Link><Network className="h-4 w-4 text-muted-foreground" /><Link href={`/contact/${suggestion.contact2_id}`} className="text-[var(--copper-text)] hover:underline">{suggestion.contact2_name}</Link></p>
                <p className="text-sm text-stone-700 dark:text-stone-300">{suggestion.reason}</p>
                <Button size="sm" variant="outline" className="min-h-11" onClick={() => navigator.clipboard.writeText(suggestion.intro_template)}><Copy className="mr-2 h-4 w-4" /> Copy mutual intro</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
