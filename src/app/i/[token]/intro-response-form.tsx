"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function IntroResponseForm({ token, requesterFirstName }: { token: string; requesterFirstName: string }) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<"yes" | "no" | null>(null)
  const [done, setDone] = useState<"accepted" | "declined" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function respond(accept: boolean) {
    setBusy(accept ? "yes" : "no")
    setError(null)
    try {
      const response = await fetch(`/api/intro/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept, note: note.trim() || null }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 409) {
        setError("You've already answered this request. Thanks!")
        return
      }
      if (!response.ok) throw new Error(body.error || "Something went wrong")
      setDone(accept ? "accepted" : "declined")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/30" role="status">
        <Check className="mx-auto h-6 w-6 text-emerald-700 dark:text-emerald-300" />
        <p className="mt-2 font-medium text-stone-900 dark:text-stone-100">
          {done === "accepted" ? `Thanks! ${requesterFirstName} will be glad to hear it.` : `Got it. We've let ${requesterFirstName} know.`}
        </p>
        {done === "accepted" && (
          <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">Forward the blurb above when you make the intro.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label htmlFor="intro-note" className="text-sm font-medium text-stone-900 dark:text-stone-100">
        Add a note for {requesterFirstName} <span className="font-normal text-stone-700 dark:text-stone-300">(optional)</span>
      </label>
      <Textarea
        id="intro-note"
        value={note}
        maxLength={1000}
        rows={3}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Happy to, will send it this week."
      />
      {error && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="min-h-11 flex-1 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] border-0 hover:opacity-90"
          onClick={() => respond(true)}
          disabled={busy !== null}
        >
          {busy === "yes" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Yes, I&apos;ll make the intro
        </Button>
        <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => respond(false)} disabled={busy !== null}>
          {busy === "no" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Not right now
        </Button>
      </div>
    </div>
  )
}
