"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, Inbox, Plus, Sparkles, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { captureEvent } from "@/components/posthog-provider"
import type { AfterCallReview, ProposedCommitment, ProposedContactPatch } from "@/lib/types"

interface ContactOption {
  id: string
  name: string | null
  company: string | null
  email: string | null
}

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : ""
}

function dateToIso(value: string): string | null {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null
}

function emptyCommitment(): ProposedCommitment {
  return {
    title: "",
    direction: "user_owes",
    details: null,
    due_at: null,
    evidence: null,
    confidence: 1,
    priority: 50,
  }
}

function sourceLabel(source: AfterCallReview["source"]): string {
  if (source === "granola") return "Granola"
  if (source === "forwarded_email") return "Forwarded email"
  if (source === "calendar") return "Google Calendar"
  return "Meeting notes"
}

function ReviewCard({
  review,
  contacts,
  onRemove,
  onApproved,
}: {
  review: AfterCallReview
  contacts: ContactOption[]
  onRemove: (id: string) => void
  onApproved: (result: { id: string; contactId: string | null; followUp: string | null }) => void
}) {
  const router = useRouter()
  const selectedRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const isSelected = searchParams.get("review") === review.id
  const [contactId, setContactId] = useState(review.contact_id || "")
  const [patch, setPatch] = useState<ProposedContactPatch>(review.proposed_contact_patch || {})
  const [commitments, setCommitments] = useState<ProposedCommitment[]>(review.proposed_commitments || [])
  const [followUp, setFollowUp] = useState(review.proposed_follow_up || "")
  const [busyAction, setBusyAction] = useState<"approve" | "dismiss" | "delete" | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isSelected) selectedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [isSelected])

  const selectedContact = useMemo(() => contacts.find((contact) => contact.id === contactId), [contacts, contactId])

  function setPatchField(field: keyof ProposedContactPatch, value: string) {
    setPatch((current) => ({ ...current, [field]: value || null }))
  }

  function updateCommitment(index: number, changes: Partial<ProposedCommitment>) {
    setCommitments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item))
  }

  async function approve() {
    setBusyAction("approve")
    setError(null)
    try {
      const response = await fetch(`/api/reviews/${review.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId || null,
          contact_patch: patch,
          commitments: commitments
            .filter((commitment) => commitment.title.trim())
            .map((commitment) => ({ ...commitment, due_at: commitment.due_at || null })),
          follow_up_draft: followUp.trim() || null,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not approve this review")
      captureEvent("meeting_review_approved", {
        commitment_count: commitments.filter((commitment) => commitment.title.trim()).length,
        created_contact: !review.contact_id && !contactId,
        source: review.source,
      })
      onApproved({ id: review.id, contactId: data.result?.contact_id || null, followUp: followUp.trim() || null })
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not approve this review")
    } finally {
      setBusyAction(null)
    }
  }

  async function removeReview(mode: "dismiss" | "delete") {
    if (mode === "delete" && !window.confirm("Permanently delete these notes and their pending review? This cannot be undone.")) return
    setBusyAction(mode)
    setError(null)
    try {
      const response = await fetch(`/api/reviews/${review.id}`, mode === "delete"
        ? { method: "DELETE" }
        : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "dismissed" }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || `Could not ${mode} this review`)
      captureEvent(mode === "delete" ? "meeting_review_deleted" : "meeting_review_dismissed", { source: review.source })
      onRemove(review.id)
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Could not ${mode} this review`)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <Card ref={selectedRef} className={`scroll-mt-24 shadow-refined ${isSelected ? "border-[var(--copper)] ring-2 ring-[var(--copper)]/15" : ""}`}>
      <CardHeader className="border-b border-stone-200 dark:border-stone-700">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-[var(--copper)]/10 px-2.5 py-1 font-medium text-[var(--copper-text)]">{sourceLabel(review.source)}</span>
              <span>{new Date(review.occurred_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <CardTitle className="text-xl font-normal">{review.title}</CardTitle>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">Needs your review</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-7 p-5 sm:p-7">
        <section aria-labelledby={`summary-${review.id}`}>
          <h3 id={`summary-${review.id}`} className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">What Savvo heard</h3>
          <p className="mt-2 leading-relaxed text-stone-800 dark:text-stone-200">{review.summary}</p>
        </section>

        <section className="space-y-4" aria-labelledby={`contact-${review.id}`}>
          <div>
            <h3 id={`contact-${review.id}`} className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Contact updates</h3>
            <p className="mt-1 text-xs text-muted-foreground">Only these reviewed fields will be applied.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`review-contact-${review.id}`}>Apply to</Label>
            <select
              id={`review-contact-${review.id}`}
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Create a new contact from this review</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name || contact.email || "Unnamed contact"}{contact.company ? ` at ${contact.company}` : ""}</option>)}
            </select>
            {selectedContact && <p className="text-xs text-muted-foreground">Reviewing updates for {selectedContact.name || selectedContact.email}.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ["name", "Name"], ["email", "Email"], ["company", "Company"],
              ["job_title", "Role"], ["how_we_met", "How you met"], ["next_steps", "Next step"],
            ] as Array<[keyof ProposedContactPatch, string]>).map(([field, label]) => (
              <div key={field} className={`space-y-2 ${field === "how_we_met" || field === "next_steps" ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={`${review.id}-${field}`}>{label}</Label>
                <Input id={`${review.id}-${field}`} value={patch[field] || ""} onChange={(event) => setPatchField(field, event.target.value)} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4" aria-labelledby={`commitments-${review.id}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 id={`commitments-${review.id}`} className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Promises and next actions</h3>
              <p className="mt-1 text-xs text-muted-foreground">Edit or remove anything that is not accurate.</p>
            </div>
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => setCommitments((current) => [...current, emptyCommitment()])}>
              <Plus className="mr-2 h-4 w-4" /> Add action
            </Button>
          </div>

          {commitments.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-center">
              <p className="text-sm font-medium">No explicit promise found</p>
              <p className="mt-1 text-xs text-muted-foreground">Add one if you or the investor agreed to a next step.</p>
            </div>
          ) : commitments.map((commitment, index) => (
            <div key={`${review.id}-commitment-${index}`} className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_9rem]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${review.id}-action-${index}`}>Action</Label>
                    <Input id={`${review.id}-action-${index}`} value={commitment.title} onChange={(event) => updateCommitment(index, { title: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${review.id}-owner-${index}`}>Owner</Label>
                    <select
                      id={`${review.id}-owner-${index}`}
                      value={commitment.direction}
                      onChange={(event) => updateCommitment(index, { direction: event.target.value as ProposedCommitment["direction"] })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="user_owes">I owe this</option>
                      <option value="contact_owes">They owe this</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${review.id}-due-${index}`}>Due</Label>
                    <Input id={`${review.id}-due-${index}`} type="date" value={dateInputValue(commitment.due_at)} onChange={(event) => updateCommitment(index, { due_at: dateToIso(event.target.value) })} />
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="min-h-11 min-w-11" aria-label={`Remove action ${index + 1}`} onClick={() => setCommitments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {commitment.evidence && <p className="mt-3 text-xs text-stone-700 dark:text-stone-300">From your notes: “{commitment.evidence}”</p>}
            </div>
          ))}
        </section>

        <section className="space-y-2" aria-labelledby={`follow-up-${review.id}`}>
          <h3 id={`follow-up-${review.id}`} className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Follow-up draft</h3>
          <Textarea value={followUp} onChange={(event) => setFollowUp(event.target.value)} className="min-h-36 leading-relaxed" placeholder="No draft yet. Add one if a follow-up would help." />
          <p className="text-xs text-muted-foreground">Savvo saves the draft with this review. It will never send it automatically.</p>
        </section>

        <details className="group rounded-lg border border-stone-200 dark:border-stone-700">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
            Original notes
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-stone-200 p-4 dark:border-stone-700">
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-stone-700 dark:text-stone-300">{review.raw_text}</pre>
            <Button variant="ghost" size="sm" className="mt-3 min-h-11 text-red-700 hover:text-red-800 dark:text-red-300" onClick={() => removeReview("delete")} disabled={busyAction !== null}>
              <Trash2 className="mr-2 h-4 w-4" /> Permanently delete notes
            </Button>
          </div>
        </details>

        {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-5 dark:border-stone-700 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" className="min-h-11" onClick={() => removeReview("dismiss")} disabled={busyAction !== null}>Dismiss review</Button>
          <Button onClick={approve} disabled={busyAction !== null} className="h-11 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] border-0 px-6">
            <Check className="mr-2 h-4 w-4" />
            {busyAction === "approve" ? "Applying approved changes..." : "Approve all changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function AfterCallInbox({ initialReviews, contacts }: { initialReviews: AfterCallReview[]; contacts: ContactOption[] }) {
  const [reviews, setReviews] = useState(initialReviews)
  const [approved, setApproved] = useState<{ id: string; contactId: string | null; followUp: string | null } | null>(null)
  const [copied, setCopied] = useState(false)

  async function copyFollowUp() {
    if (!approved?.followUp) return
    await navigator.clipboard.writeText(approved.followUp)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function deleteApprovedNotes() {
    if (!approved || !window.confirm("Permanently delete the original meeting notes? Approved commitments and the contact timeline summary will remain.")) return
    const response = await fetch(`/api/reviews/${approved.id}`, { method: "DELETE" })
    if (response.ok) {
      setApproved((current) => current ? { ...current, id: "" } : null)
      captureEvent("approved_meeting_notes_deleted")
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div className="animate-fade-in">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--copper-text)]">Human approval first</p>
            <h1 className="mt-1 text-3xl font-normal tracking-tight sm:text-4xl">After-call inbox</h1>
            <p className="mt-1 text-base text-muted-foreground sm:text-lg">Review what Savvo found before anything changes.</p>
          </div>
          <Button asChild className="min-h-11 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] border-0">
            <Link href="/capture"><Plus className="mr-2 h-4 w-4" /> Capture meeting</Link>
          </Button>
        </div>
      </div>

      {approved && (
        <Card className="border-emerald-300 bg-emerald-50 shadow-refined dark:border-emerald-800 dark:bg-emerald-950/30">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100">Your next move is ready</h2>
                <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">The meeting and approved commitments are saved. They now shape your Moves list.</p>
                {approved.followUp && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-4 dark:border-emerald-800 dark:bg-stone-900">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800 dark:text-stone-200">{approved.followUp}</p>
                    <Button variant="outline" size="sm" className="mt-3 min-h-11" onClick={copyFollowUp}>
                      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied ? "Copied" : "Copy follow-up"}
                    </Button>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" className="min-h-11" asChild><Link href="/moves">See next moves <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                  {approved.contactId && <Button variant="ghost" size="sm" className="min-h-11" asChild><Link href={`/contact/${approved.contactId}`}>Open contact</Link></Button>}
                  {approved.id && <Button variant="ghost" size="sm" className="min-h-11 text-red-700 dark:text-red-300" onClick={deleteApprovedNotes}><Trash2 className="mr-2 h-4 w-4" />Delete original notes</Button>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reviews.length === 0 && !approved ? (
        <Card className="shadow-refined">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--copper)]/10">
              <Inbox className="h-7 w-7 text-[var(--copper-text)]" />
            </div>
            <h2 className="text-xl font-normal">Your review inbox is clear</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Paste an investor conversation and Savvo will prepare the next actions, contact updates, and follow-up for approval.</p>
            <Button className="mt-6 min-h-11" asChild>
              <Link href="/capture"><Sparkles className="mr-2 h-4 w-4" /> Find my next move <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      ) : reviews.length > 0 ? (
        <div className="space-y-5">
          {reviews.map((review) => <ReviewCard
            key={review.id}
            review={review}
            contacts={contacts}
            onRemove={(id) => setReviews((current) => current.filter((item) => item.id !== id))}
            onApproved={({ id, contactId, followUp }) => {
              setReviews((current) => current.filter((item) => item.id !== id))
              setApproved({ id, contactId, followUp })
            }}
          />)}
        </div>
      ) : null}
    </div>
  )
}
