"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, FileText, LockKeyhole, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { captureEvent } from "@/components/posthog-provider"
import type { PlanType, ReviewSource } from "@/lib/types"

interface ContactOption {
  id: string
  name: string | null
  company: string | null
  email: string | null
}

function defaultLocalDateTime(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

const SOURCE_OPTIONS: Array<{ value: ReviewSource; label: string }> = [
  { value: "manual", label: "Meeting notes" },
  { value: "granola", label: "Granola notes" },
  { value: "forwarded_email", label: "Forwarded email" },
]

export function CaptureMeetingForm({ contacts, plan, initialContactId = "" }: { contacts: ContactOption[]; plan: PlanType; initialContactId?: string }) {
  const router = useRouter()
  const [contactId, setContactId] = useState(initialContactId)
  const [source, setSource] = useState<ReviewSource>("manual")
  const [title, setTitle] = useState("Investor meeting")
  const [occurredAt, setOccurredAt] = useState(defaultLocalDateTime)
  const [rawText, setRawText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === contactId),
    [contacts, contactId]
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    captureEvent("meeting_capture_submitted", { source, has_existing_contact: Boolean(contactId) })
    try {
      const response = await fetch("/api/reviews/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId || null,
          source,
          title,
          occurred_at: new Date(occurredAt).toISOString(),
          raw_text: rawText,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not analyze these notes")
      captureEvent("meeting_review_created", {
        source,
        deduplicated: Boolean(data.deduplicated),
        commitment_count: data.review?.proposed_commitments?.length || 0,
      })
      router.push(`/inbox?review=${data.review.id}`)
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not analyze these notes")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="animate-fade-in">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--copper)]/10">
            <FileText className="h-5 w-5 text-[var(--copper-text)]" />
          </div>
          <div>
            <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">Capture a meeting</h1>
            <p className="mt-1 text-base text-muted-foreground sm:text-lg">
              Paste what happened. Savvo will find the promises and next step for you to approve.
            </p>
          </div>
        </div>
      </div>

      <Card className="shadow-refined">
        <CardContent className="p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="capture-contact">Who was the meeting with?</Label>
                <select
                  id="capture-contact"
                  value={contactId}
                  onChange={(event) => setContactId(event.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Let Savvo identify them from the notes</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name || contact.email || "Unnamed contact"}{contact.company ? ` at ${contact.company}` : ""}
                    </option>
                  ))}
                </select>
                {selectedContact && <p className="text-xs text-muted-foreground">Updates will be proposed for {selectedContact.name || selectedContact.email}.</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="capture-source">Source</Label>
                <select
                  id="capture-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value as ReviewSource)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capture-time">When?</Label>
                <Input id="capture-time" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="h-11" required />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="capture-title">Meeting title</Label>
                <Input id="capture-title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-11" maxLength={200} required />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-end justify-between gap-3">
                  <Label htmlFor="capture-notes">Notes or transcript</Label>
                  <span className="text-xs text-muted-foreground">{rawText.length.toLocaleString()} / 100,000</span>
                </div>
                <Textarea
                  id="capture-notes"
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder="Example: Maya liked the enterprise traction but asked about churn. I promised to send the cohort analysis by Friday. She will introduce me to her fintech partner after reviewing it."
                  className="min-h-64 resize-y leading-relaxed"
                  minLength={20}
                  maxLength={100000}
                  required
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                {error}
                {error.includes("Upgrade") && plan === "free" && <Link href="/pricing" className="ml-2 font-semibold underline">View Pro</Link>}
              </div>
            )}

            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[var(--copper-text)]" />
                <div className="text-sm text-stone-700 dark:text-stone-300">
                  <p className="font-medium text-stone-900 dark:text-stone-100">Nothing changes until you approve it.</p>
                  <p className="mt-1">The original text stays private in your review inbox and can be permanently deleted at any time. Savvo never sends a message for you.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Usually ready in under 30 seconds.</p>
              <Button
                type="submit"
                disabled={isSubmitting || rawText.trim().length < 20}
                className="h-11 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] border-0 px-6"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {isSubmitting ? "Finding your next moves..." : "Analyze for review"}
                {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
