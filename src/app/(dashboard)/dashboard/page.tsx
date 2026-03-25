export const dynamic = "force-dynamic"

import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"

import { calculateHealthScore } from "@/lib/health"
import { getUserPlan } from "@/lib/subscription"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContactCard } from "@/components/contact-card"
import { ReachOutList, type ReachOutContact } from "@/components/reach-out-list"
import { NewRelationships } from "@/components/new-relationships"
import { CalendarConnectButton } from "@/components/calendar-connect-button"
import { ManageSubscriptionButton } from "@/components/manage-subscription-button"
import { UpgradeToast } from "@/components/upgrade-toast"
import { EventModeBanner } from "@/components/event-mode-banner"
import { StartEventButton } from "@/components/start-event-button"
import { WelcomeExperience } from "@/components/welcome-experience"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import { DashboardWalkthrough } from "@/components/dashboard-walkthrough"
import { DashboardHeader } from "@/components/dashboard-header"
import { Plus, Users, ArrowRight, ThermometerSnowflake, Crown, HandHeart } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const plan = await getUserPlan(user.id)

  // Check if calendar is connected
  let calendarConnected = false
  if (plan === "pro") {
    const serviceSupabase = await createServiceClient()
    const { data: integration } = await serviceSupabase
      .from("integrations")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "google_calendar")
      .single()
    calendarConnected = !!integration
  }

  // Fetch stats
  const { count: totalContacts } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user.id)

  const { data: allContacts } = await supabase
    .from("contacts")
    .select("id, name, email, phone, company, job_title, website, how_we_met, next_steps, follow_up_needed, last_contact_date, raw_note, source, created_by, created_at, updated_at, archived_at, embedding_status")
    .eq("created_by", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })

  // Calculate health scores for all contacts
  const contactsWithHealth = (allContacts || []).map((c) => ({
    ...c,
    health: calculateHealthScore(c.last_contact_date, c.created_at),
  }))

  // --- Reach Out Today: unified prioritized list ---
  const now = new Date().getTime()
  const daysSince = (dateStr: string | null, fallback: string) => {
    const ref = dateStr || fallback
    return Math.floor((now - new Date(ref).getTime()) / (1000 * 60 * 60 * 24))
  }

  const formatDaysAgo = (days: number): string => {
    if (days <= 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 30) return `${days} days ago`
    const months = Math.floor(days / 30)
    return months === 1 ? "1 month ago" : `${months} months ago`
  }

  // Priority 1: follow_up_needed contacts that aren't green (green = already healthy)
  const followUpContacts: ReachOutContact[] = contactsWithHealth
    .filter((c) => c.follow_up_needed && c.health.level !== "green")
    .sort((a, b) => {
      const aDate = new Date(a.last_contact_date || a.created_at).getTime()
      const bDate = new Date(b.last_contact_date || b.created_at).getTime()
      return aDate - bDate
    })
    .map((c) => ({ ...c, reason: "Follow-up needed" }))

  // Priority 2: orange or red health, oldest first (exclude already in follow-ups)
  const followUpIds = new Set(followUpContacts.map((c) => c.id))
  const coldContacts: ReachOutContact[] = contactsWithHealth
    .filter((c) => !followUpIds.has(c.id) && (c.health.level === "orange" || c.health.level === "red"))
    .sort((a, b) => {
      const aDate = new Date(a.last_contact_date || a.created_at).getTime()
      const bDate = new Date(b.last_contact_date || b.created_at).getTime()
      return aDate - bDate
    })
    .map((c) => ({
      ...c,
      reason: formatDaysAgo(daysSince(c.last_contact_date, c.created_at)),
    }))

  // Combine priority 1 + 2
  let reachOutContacts = [...followUpContacts, ...coldContacts]

  // Priority 3: yellow + 45+ days, only if list < 5
  if (reachOutContacts.length < 5) {
    const existingIds = new Set(reachOutContacts.map((c) => c.id))
    const coolingContacts: ReachOutContact[] = contactsWithHealth
      .filter((c) => {
        if (existingIds.has(c.id)) return false
        if (c.health.level !== "yellow") return false
        return daysSince(c.last_contact_date, c.created_at) >= 45
      })
      .sort((a, b) => {
        const aDate = new Date(a.last_contact_date || a.created_at).getTime()
        const bDate = new Date(b.last_contact_date || b.created_at).getTime()
        return aDate - bDate
      })
      .map((c) => ({
        ...c,
        reason: formatDaysAgo(daysSince(c.last_contact_date, c.created_at)),
      }))
    reachOutContacts = [...reachOutContacts, ...coolingContacts]
  }

  const reachOutTotal = reachOutContacts.length
  const reachOutCapped = reachOutContacts.slice(0, 8)

  // --- New in Your Network: added in last 7 days, not yet followed up ---
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const newContacts = contactsWithHealth
    .filter((c) => {
      const createdAt = new Date(c.created_at).getTime()
      if (createdAt < sevenDaysAgo) return false
      // Not yet followed up: last_contact_date is null or within 1 minute of created_at
      if (!c.last_contact_date) return true
      const lastContact = new Date(c.last_contact_date).getTime()
      const created = new Date(c.created_at).getTime()
      return Math.abs(lastContact - created) < 60_000
    })
    .slice(0, 4)

  const recentContacts = contactsWithHealth.slice(0, 6)
  const isEmpty = (allContacts || []).length === 0

  // Brand new user — guided welcome experience
  if (isEmpty) {
    const userName = user.user_metadata?.full_name || null
    const userEmail = user.email || null
    return (
      <div className="space-y-8">
        <Suspense fallback={null}>
          <UpgradeToast />
        </Suspense>
        <WelcomeExperience userName={userName} userEmail={userEmail} plan={plan} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <UpgradeToast />
      </Suspense>
      <EventModeBanner />
      {/* Walkthrough tooltip tour for users with 1-4 contacts */}
      <DashboardWalkthrough contactCount={totalContacts || 0} />
      {/* Onboarding checklist for users with < 10 contacts */}
      <OnboardingChecklist contactCount={totalContacts || 0} />
      {/* Contact limit warning for free users approaching 50 */}
      {plan === "free" && (totalContacts || 0) >= 45 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {(totalContacts || 0)}/50 contacts used. {50 - (totalContacts || 0) === 0 ? "You've hit the limit." : `${50 - (totalContacts || 0)} remaining.`}
          </p>
          <Button size="sm" asChild className="shrink-0 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0 text-xs h-7">
            <Link href="/pricing">Upgrade to Pro</Link>
          </Button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 animate-fade-in">
        <DashboardHeader userName={user.user_metadata?.full_name || null} />
        <div className="flex items-center gap-3 flex-wrap">
          {plan === "pro" && (
            <CalendarConnectButton isConnected={calendarConnected} />
          )}
          {plan === "free" ? (
            <Button variant="outline" size="sm" asChild className="border-[var(--copper)]/30 text-[var(--copper)] hover:bg-[var(--copper)]/5">
              <Link href="/pricing">
                <Crown className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </Link>
            </Button>
          ) : (
            <ManageSubscriptionButton />
          )}
          <Button asChild className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 shadow-md hover:shadow-lg border-0" data-tour="add-contact-btn">
            <Link href="/add">
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger-children">
        <Card className="shadow-refined">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-normal whitespace-nowrap">{totalContacts || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {plan === "free" ? `${totalContacts || 0}/50 on free plan` : "in your network"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-refined" data-tour="stats-reach-out">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reach Out</CardTitle>
            <HandHeart className="h-4 w-4 text-[var(--copper)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-normal whitespace-nowrap">{reachOutTotal}</div>
            <p className="text-sm text-muted-foreground mt-1">
              need attention
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-refined" data-tour="stats-cold">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Going Cold</CardTitle>
            <ThermometerSnowflake className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-normal whitespace-nowrap">
              {contactsWithHealth.filter((c) => c.health.level === "orange" || c.health.level === "red").length}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              going cold
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-refined">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-between group" asChild>
              <Link href="/search">
                Search Contacts
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
            </Button>
            {plan === "pro" && (
              <>
                <Button variant="outline" size="sm" className="w-full justify-between group" asChild>
                  <Link href="/import">
                    Import Contacts
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </Button>
                <StartEventButton />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New in Your Network */}
      {newContacts.length > 0 && (
        <NewRelationships contacts={newContacts} />
      )}

      {/* Reach Out Today */}
      <ReachOutList contacts={reachOutCapped} plan={plan} total={reachOutTotal} />

      {/* Recent Contacts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-normal">Recent Contacts</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[var(--copper)]" asChild>
            <Link href="/contacts" className="flex items-center gap-2">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {recentContacts && recentContacts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {recentContacts.map((contact) => (
              <div key={contact.id} className="card-interactive">
                <ContactCard contact={contact} />
              </div>
            ))}
          </div>
        ) : (
          <Card className="shadow-refined">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-[var(--copper)]/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-[var(--copper)]" />
              </div>
              <h3 className="text-xl font-normal">No contacts yet</h3>
              <p className="text-muted-foreground text-center max-w-sm mt-2">
                Start building your network by adding your first contact.
              </p>
              <Button className="mt-6 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 shadow-md border-0" asChild>
                <Link href="/add">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Contact
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
