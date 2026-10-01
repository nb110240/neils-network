"use client"

import { useEffect, useState } from "react"
import { Check, Clipboard, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { captureEvent } from "@/components/posthog-provider"

interface ReferralState {
  url: string
  signedUp: number
  rewarded: number
  rewardDays: number
  rewardCap: number
  proCreditUntil: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function ReferralCard() {
  const [state, setState] = useState<ReferralState | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/referrals")
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error)
        if (!cancelled) setState(body)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const copyLink = async () => {
    if (!state) return
    try {
      await navigator.clipboard.writeText(state.url)
      setCopied(true)
      captureEvent("referral_link_copied")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked (permissions, insecure context); the link
      // stays visible and selectable.
    }
  }

  if (failed) return null

  return (
    <Card className="shadow-refined">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-normal">
          <Gift className="h-4 w-4 text-muted-foreground" />
          Invite founders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-stone-700 dark:text-stone-300">
          Know someone raising? When they join with your link and add their first contact, you get{" "}
          {state?.rewardDays ?? 30} days of Pro.
        </p>

        {!state ? (
          <div className="h-11 rounded-lg bg-muted animate-pulse" role="status" aria-label="Loading referral link" />
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-stone-50 px-3 py-2.5 text-sm text-stone-900 dark:bg-stone-950 dark:text-stone-100">
                {state.url}
              </code>
              <Button type="button" variant="outline" className="min-h-11" onClick={copyLink}>
                {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Clipboard className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            <p className="text-xs text-stone-700 dark:text-stone-300">
              {state.signedUp === 0
                ? "No one has joined with your link yet."
                : `${state.signedUp} joined · ${state.rewarded} earned you Pro`}
              {state.proCreditUntil && ` · Pro credit until ${formatDate(state.proCreditUntil)}`}
              {state.rewarded >= state.rewardCap && ` · You've reached the ${state.rewardCap}-month limit`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
