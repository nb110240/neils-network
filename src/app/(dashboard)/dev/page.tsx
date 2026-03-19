"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import {
  Loader2,
  Shield,
  Database,
  Users,
  CreditCard,
  Mail,
  Calendar,
  Search,
  RefreshCw,
} from "lucide-react"

const ADMIN_EMAILS = ["neilbajaj72@gmail.com"]

interface Stats {
  plan: string
  contactCount: number
}

export default function DevPage() {
  const supabase = createClient()
  const { addToast } = useToast()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState("")
  const [userId, setUserId] = useState("")
  const [stats, setStats] = useState<Stats>({ plan: "free", contactCount: 0 })
  const [allUsers, setAllUsers] = useState<{ id: string; email: string; plan: string }[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
        setIsAdmin(false)
        setIsLoading(false)
        return
      }
      setIsAdmin(true)
      setUserEmail(user.email || "")
      setUserId(user.id)

      const res = await fetch("/api/settings/plan")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }

      await loadUsers()
      setIsLoading(false)
    }
    init()
  }, [supabase])

  async function loadUsers() {
    const res = await fetch("/api/dev/users")
    if (res.ok) {
      const data = await res.json()
      setAllUsers(data.users || [])
    }
  }

  async function togglePlan(targetUserId: string, currentPlan: string) {
    setActionLoading(`plan-${targetUserId}`)
    const newPlan = currentPlan === "pro" ? "free" : "pro"
    const res = await fetch("/api/dev/toggle-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, plan: newPlan }),
    })
    if (res.ok) {
      addToast({ title: "Plan updated", description: `Set to ${newPlan}` })
      await loadUsers()
      if (targetUserId === userId) {
        const planRes = await fetch("/api/settings/plan")
        if (planRes.ok) setStats(await planRes.json())
      }
    } else {
      addToast({ title: "Error", description: "Failed to update plan", variant: "destructive" })
    }
    setActionLoading(null)
  }

  async function triggerDigest() {
    setActionLoading("digest")
    const res = await fetch("/api/dev/trigger-digest", { method: "POST" })
    const data = await res.json()
    addToast({
      title: res.ok ? "Digest triggered" : "Error",
      description: res.ok ? `Sent to ${data.sent || 0} users` : data.message,
      variant: res.ok ? undefined : "destructive",
    })
    setActionLoading(null)
  }

  async function triggerCalendarSync() {
    setActionLoading("calendar")
    const res = await fetch("/api/calendar/sync", { method: "POST" })
    const data = await res.json()
    addToast({
      title: res.ok ? "Calendar synced" : "Error",
      description: res.ok ? `${data.newContacts || 0} new contacts` : data.message,
      variant: res.ok ? undefined : "destructive",
    })
    setActionLoading(null)
  }

  async function reEmbed() {
    setActionLoading("embed")
    const res = await fetch("/api/dev/re-embed", { method: "POST" })
    const data = await res.json()
    addToast({
      title: res.ok ? "Re-embedding started" : "Error",
      description: res.ok ? `Processing ${data.count || 0} contacts` : data.message,
      variant: res.ok ? undefined : "destructive",
    })
    setActionLoading(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-10 w-10 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-normal">Access Denied</h1>
        <p className="text-muted-foreground mt-1">This page is for developers only.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-normal tracking-tight">Developer Mode</h1>
        <p className="text-muted-foreground">
          Logged in as {userEmail} &middot; {stats.plan} plan &middot; {stats.contactCount} contacts
        </p>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={triggerDigest}
              disabled={actionLoading === "digest"}
              className="justify-start h-11"
            >
              {actionLoading === "digest" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send Digest Now
            </Button>
            <Button
              variant="outline"
              onClick={triggerCalendarSync}
              disabled={actionLoading === "calendar"}
              className="justify-start h-11"
            >
              {actionLoading === "calendar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
              Sync Calendar Now
            </Button>
            <Button
              variant="outline"
              onClick={reEmbed}
              disabled={actionLoading === "embed"}
              className="justify-start h-11"
            >
              {actionLoading === "embed" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Re-embed All Contacts
            </Button>
            <Button
              variant="outline"
              onClick={() => { loadUsers(); addToast({ title: "Refreshed" }) }}
              className="justify-start h-11"
            >
              <Database className="mr-2 h-4 w-4" />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <Users className="h-4 w-4 text-muted-foreground" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {allUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{u.email}</p>
                  <p className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}...</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.plan === "pro" ? "bg-[var(--copper)] text-white" : "bg-muted text-muted-foreground"}`}>
                    {u.plan}
                  </span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`plan-${u.id}`} className="text-xs text-muted-foreground">Pro</Label>
                    <Switch
                      id={`plan-${u.id}`}
                      checked={u.plan === "pro"}
                      onCheckedChange={() => togglePlan(u.id, u.plan)}
                      disabled={actionLoading === `plan-${u.id}`}
                    />
                  </div>
                </div>
              </div>
            ))}
            {allUsers.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No users found</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            System Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Stripe</p>
              <p className="font-mono text-xs">{process.env.NEXT_PUBLIC_APP_URL ? "Configured" : "Keys in .env.local"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Embedding Model</p>
              <p className="font-mono text-xs">text-embedding-3-small</p>
            </div>
            <div>
              <p className="text-muted-foreground">Extraction Model</p>
              <p className="font-mono text-xs">gpt-4o-mini</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Users</p>
              <p className="font-mono text-xs">{allUsers.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
