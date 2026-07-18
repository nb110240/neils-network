"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Clipboard, Loader2, MailPlus, RefreshCw, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"

interface InboundAddressState {
  available: boolean
  requires_upgrade?: boolean
  enabled?: boolean
  address?: string | null
}

interface InboundNotesAddressProps {
  accountEmail: string
  isPaidPlan: boolean
}

export function InboundNotesAddress({ accountEmail, isPaidPlan }: InboundNotesAddressProps) {
  const [state, setState] = useState<InboundAddressState | null>(null)
  const [loading, setLoading] = useState(isPaidPlan)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  const loadAddress = useCallback(async () => {
    if (!isPaidPlan) {
      setState({ available: false, requires_upgrade: true })
      setLoading(false)
      return
    }
    try {
      const response = await fetch("/api/inbound-address")
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not load your forwarding address")
      setState(body)
    } catch (error) {
      addToast({
        title: "Forwarding address unavailable",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, isPaidPlan])

  useEffect(() => {
    void loadAddress()
  }, [loadAddress])

  const copyAddress = async () => {
    if (!state?.address) return
    await navigator.clipboard.writeText(state.address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const rotateAddress = async () => {
    if (state?.address && !window.confirm("Replace this address? The old one will stop working immediately.")) return
    setRotating(true)
    try {
      const response = await fetch("/api/inbound-address", { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not replace the address")
      setState(body)
      addToast({ title: state?.address ? "Forwarding address replaced" : "Forwarding enabled" })
    } catch (error) {
      addToast({
        title: "Could not update forwarding",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setRotating(false)
    }
  }

  return (
    <Card className="shadow-refined">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-normal">
          <MailPlus className="h-4 w-4 text-muted-foreground" />
          Forward meeting notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-stone-700 dark:text-stone-300">
          Forward a meeting recap from your Savvo account email. Savvo extracts proposed updates and puts them in Review Inbox.
        </p>

        {!isPaidPlan ? (
          <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-900/40 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-700 dark:text-stone-300">Email forwarding is included with Pro.</p>
            <Button size="sm" className="min-h-11" asChild><Link href="/pricing">Upgrade to Pro</Link></Button>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating your private address...
          </div>
        ) : state?.available && state.address ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-stone-50 px-3 py-2.5 text-sm text-stone-900 dark:bg-stone-950 dark:text-stone-100">
                {state.address}
              </code>
              <Button type="button" variant="outline" className="min-h-11" onClick={copyAddress}>
                {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Clipboard className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send from {accountEmail || "the email on your Savvo account"}. Paste notes in the email body; attachments are not imported yet.
            </p>
            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={rotateAddress} disabled={rotating}>
              {rotating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Replace address
            </Button>
          </div>
        ) : state?.available && state.enabled === false ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={rotateAddress} disabled={rotating}>
            {rotating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enable forwarding
          </Button>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            Email forwarding is not configured on this deployment yet. Pasting notes in Capture still works.
          </p>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Nothing is sent and no CRM data changes until you approve the review.
        </div>
      </CardContent>
    </Card>
  )
}
