"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ExternalLink, FileAudio, Loader2, RefreshCw, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"

interface GranolaStatus {
  connected: boolean
  can_connect: boolean
  last_sync_at?: string | null
}

export function GranolaIntegration({ isPaidPlan }: { isPaidPlan: boolean }) {
  const [status, setStatus] = useState<GranolaStatus | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [loading, setLoading] = useState(isPaidPlan)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    if (!isPaidPlan) {
      setStatus({ connected: false, can_connect: false })
      setLoading(false)
      return
    }
    void fetch("/api/granola")
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Could not load Granola")
        setStatus(body)
      })
      .catch((error) => addToast({
        title: "Granola unavailable",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      }))
      .finally(() => setLoading(false))
  }, [addToast, isPaidPlan])

  const sync = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/granola/sync", { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not sync Granola")
      setStatus((current) => ({
        connected: true,
        can_connect: true,
        ...current,
        last_sync_at: new Date().toISOString(),
      }))
      addToast({
        title: body.imported ? `${body.imported} meeting${body.imported === 1 ? "" : "s"} ready to review` : "Granola is up to date",
        description: body.failed ? `${body.failed} note${body.failed === 1 ? "" : "s"} will be retried.` : "Nothing changed until you approve each review.",
      })
    } catch (error) {
      addToast({
        title: "Granola sync failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const connect = async (event: React.FormEvent) => {
    event.preventDefault()
    setConnecting(true)
    try {
      const response = await fetch("/api/granola", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not connect Granola")
      setStatus(body)
      setApiKey("")
      addToast({ title: "Granola connected", description: "Importing your recent meetings now." })
      await sync()
    } catch (error) {
      addToast({
        title: "Could not connect Granola",
        description: error instanceof Error ? error.message : "Check your API key and try again",
        variant: "destructive",
      })
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    if (!window.confirm("Disconnect Granola? Reviews already imported into Savvo will remain.")) return
    const response = await fetch("/api/granola", { method: "DELETE" })
    const body = await response.json()
    if (!response.ok) {
      addToast({ title: "Could not disconnect Granola", description: body.error, variant: "destructive" })
      return
    }
    setStatus(body)
    addToast({ title: "Granola disconnected" })
  }

  return (
    <Card className="shadow-refined">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-normal">
          <FileAudio className="h-4 w-4 text-muted-foreground" />
          Granola meeting notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-stone-700 dark:text-stone-300">
          Import recent summaries and transcripts into Review Inbox. Savvo matches an attendee only by exact email and never applies extracted changes automatically.
        </p>

        {!isPaidPlan ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-stone-50 p-4 dark:bg-stone-900/40 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-700 dark:text-stone-300">Granola sync is included with Savvo Pro.</p>
            <Button size="sm" className="min-h-11" asChild><Link href="/pricing">Upgrade to Pro</Link></Button>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking Granola connection...
          </div>
        ) : status?.connected ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-200">
                  <Check className="h-4 w-4" /> Connected
                </p>
                <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                  {status.last_sync_at
                    ? `Syncs every night. Last synced ${new Date(status.last_sync_at).toLocaleString()}`
                    : "Syncs every night."}
                </p>
              </div>
              <Button type="button" size="sm" className="min-h-11" onClick={sync} disabled={syncing}>
                {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync now
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={disconnect}>
              <Unplug className="mr-2 h-4 w-4" /> Disconnect
            </Button>
          </div>
        ) : (
          <form onSubmit={connect} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="granola-api-key">Personal API key</Label>
              <Input
                id="granola-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="grn_..."
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Create one in Granola Settings → Connectors → API keys. Granola currently offers API keys on Business and Enterprise plans.{" "}
                <a href="https://docs.granola.ai/introduction" target="_blank" rel="noreferrer" className="inline-flex items-center underline underline-offset-2">
                  Granola API guide <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </p>
            </div>
            <Button type="submit" className="min-h-11" disabled={connecting || apiKey.trim().length < 10}>
              {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect and import
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
