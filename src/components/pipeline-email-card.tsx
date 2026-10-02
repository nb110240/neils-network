"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Mail, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"

interface Recipient {
  id: string
  email: string
  last_sent_at: string | null
  unsubscribed_at: string | null
}

/**
 * Settings: share the investor pipeline with a co-founder or advisor every
 * Monday. What's shared is spelled out here, before anyone is added.
 */
export function PipelineEmailCard({ isPaidPlan }: { isPaidPlan: boolean }) {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [max, setMax] = useState(3)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(isPaidPlan)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    if (!isPaidPlan) return
    void fetch("/api/settings/pipeline-digest")
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Could not load your pipeline email")
        setRecipients(body.recipients)
        setMax(body.max)
      })
      .catch((error) => addToast({
        title: "Pipeline email unavailable",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      }))
      .finally(() => setLoading(false))
  }, [addToast, isPaidPlan])

  const active = recipients.filter((r) => !r.unsubscribed_at)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setAdding(true)
    try {
      const response = await fetch("/api/settings/pipeline-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not add that person")
      setRecipients((current) => [...current, body.recipient])
      setEmail("")
      addToast({ title: "Added", description: `${body.recipient.email} gets your pipeline every Monday.` })
    } catch (error) {
      addToast({
        title: "Couldn't add them",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  const remove = async (recipient: Recipient) => {
    setRemovingId(recipient.id)
    try {
      const response = await fetch(`/api/settings/pipeline-digest?id=${recipient.id}`, { method: "DELETE" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Could not remove them")
      }
      setRecipients((current) => current.filter((r) => r.id !== recipient.id))
    } catch (error) {
      addToast({
        title: "Couldn't remove them",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Card className="shadow-refined">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-normal">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Weekly pipeline email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-stone-700 dark:text-stone-300">
          Keep a co-founder or advisor in the loop. Every Monday they get your stage counts, the investors you met
          that week, and your late-stage conversations: names, firms and stages only. Notes and meeting details stay
          private. Replies come to you.
        </p>

        {!isPaidPlan ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-stone-50 p-4 dark:bg-stone-900/40 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-700 dark:text-stone-300">The weekly pipeline email is included with Savvo Pro.</p>
            <Button size="sm" className="min-h-11" asChild><Link href="/pricing">Upgrade to Pro</Link></Button>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="space-y-3">
            {recipients.length > 0 && (
              <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-900">
                {recipients.map((recipient) => (
                  <li key={recipient.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">{recipient.email}</p>
                      <p className="text-xs text-stone-700 dark:text-stone-300">
                        {recipient.unsubscribed_at
                          ? "Unsubscribed"
                          : recipient.last_sent_at
                            ? `Last sent ${new Date(recipient.last_sent_at).toLocaleDateString()}`
                            : "First email on Monday"}
                      </p>
                    </div>
                    {!recipient.unsubscribed_at && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 shrink-0"
                        onClick={() => remove(recipient)}
                        disabled={removingId === recipient.id}
                        aria-label={`Stop sending to ${recipient.email}`}
                      >
                        {removingId === recipient.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {active.length < max ? (
              <form onSubmit={add} className="space-y-2">
                <Label htmlFor="pipeline-email">Send to</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="pipeline-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="cofounder@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={320}
                    className="bg-white dark:bg-stone-900"
                  />
                  <Button type="submit" variant="copper" className="min-h-11 shrink-0" disabled={adding || !email.trim()}>
                    {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Add
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-stone-700 dark:text-stone-300">You’re sharing with the maximum of {max} people.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
