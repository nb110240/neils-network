export const dynamic = "force-dynamic"

import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"

import { calculateHealthScore } from "@/lib/health"
import { CONTACT_COLUMNS } from "@/lib/contact-columns"
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
import { InstallPrompt } from "@/components/install-prompt"
import { FollowUpList, type FollowUpContact } from "@/components/follow-up-list"
import { Plus, Users, ArrowRight, ThermometerSnowflake, Crown, HandHeart } from "lucide-react"

function cadenceLabel(days: number): string {
  if (days === 7) return "Weekly"
  if (days === 14) return "Every 2 weeks"
  if (days === 30) return "Monthly"
  if (days === 90) return "Quarterly"
  return `Every ${days} days`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Plan and the full unarchived contact set are independent (both only need
  // user.id), so fetch them in parallel instead of serially. The list IS the
  // complete unarchived set, so its length is the total contact count — a
  // separate COUNT round-trip was redundant.
  const [plan, { data: allContacts }] = await Promise.all([
    getUserPlan(user.id),
    supabase
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("created_by", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ])

  const totalContacts = allContacts?.length ?? 0

  // Check if calendar is connected (Pro only)
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

  // Calculate health scores for all contacts
  const contactsWithHealth = (allContacts || []).map((c) => ({
    ...c,
    health: calculateHealthScore(c.last_contact_date, c.created_at, c.cadence_days),
  }))

  // --- Reach Out Today: unified prioritized list ---
  const now = new Date().getTime()
  const todayStr = new Date().toISOString().split("T")[0]
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

  // Filter out snoozed contacts from reach-out lists
  const isSnoozed = (c: typeof contactsWithHealth[0]) =>
    c.snoozed_until && c.snoozed_until >= todayStr
  const activeContacts = contactsWithHealth.filter((c) => !isSnoozed(c))

  // Priority 0 (NEW): Contacts with next_due_date <= today (user-scheduled)
  const scheduledContacts: ReachOutContact[] = activeContacts
    .filter((c) => c.next_due_date && c.next_due_date <= todayStr)
    .sort((a, b) => (a.next_due_date || "").localeCompare(b.next_due_date || ""))
    .map((c) => ({
      ...c,
      reason: c.cadence_days
        ? `${cadenceLabel(c.cadence_days)}, due`
        : "Scheduled follow-up",
    }))

  const scheduledIds = new Set(scheduledContacts.map((c) => c.id))

  // Priority 1: follow_up_needed contacts that aren't green (green = already healthy)
  const followUpContacts: ReachOutContact[] = activeContacts
    .filter((c) => !scheduledIds.has(c.id) && c.follow_up_needed && c.health.level !== "green")
    .sort((a, b) => {
      const aDate = new Date(a.last_contact_date || a.created_at).getTime()
      const bDate = new Date(b.last_contact_date || b.created_at).getTime()
      return aDate - bDate
    })
    .map((c) => ({ ...c, reason: "Follow-up needed" }))

  // Priority 2: orange or red health, oldest first (exclude already listed)
  const listedIds = new Set([...scheduledIds, ...followUpContacts.map((c) => c.id)])
  const coldContacts: ReachOutContact[] = activeContacts
    .filter((c) => !listedIds.has(c.id) && (c.health.level === "orange" || c.health.level === "red"))
    .sort((a, b) => {
      const aDate = new Date(a.last_contact_date || a.created_at).getTime()
      const bDate = new Date(b.last_contact_date || b.created_at).getTime()
      return aDate - bDate
    })
    .map((c) => ({
      ...c,
      reason: formatDaysAgo(daysSince(c.last_contact_date, c.created_at)),
    }))

  // Combine priority 0 + 1 + 2
  let reachOutContacts = [...scheduledContacts, ...followUpContacts, ...coldContacts]

  // Priority 3: yellow + 45+ days, only if list < 5
  if (reachOutContacts.length < 5) {
    const existingIds = new Set(reachOutContacts.map((c) => c.id))
    const coolingContacts: ReachOutContact[] = activeContacts
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

  // --- Follow-ups Pending: contacts with follow_up_needed, with trigger date ---
  const allFollowUpContacts = contactsWithHealth.filter((c) => c.follow_up_needed)
  const followUpContactIds = allFollowUpContacts.map((c) => c.id)

  // Get the most recent activity with follow_up_needed for each contact
  let followUpTriggerDates = new Map<string, { date: string; context: string | null }>()
  if (followUpContactIds.length > 0) {
    const { data: followUpActivities } = await supabase
      .from("contact_activities")
      .select("contact_id, occurred_at, content")
      .in("contact_id", followUpContactIds)
      .eq("follow_up_needed", true)
      .order("occurred_at", { ascending: false })

    if (followUpActivities) {
      for (const a of followUpActivities) {
        // Only keep the most recent per contact
        if (!followUpTriggerDates.has(a.contact_id)) {
          followUpTriggerDates.set(a.contact_id, {
            date: a.occurred_at,
            context: a.content?.slice(0, 80) || null,
          })
        }
      }
    }
  }

  const followUpList: FollowUpContact[] = allFollowUpContacts
    .map((c) => {
      const trigger = followUpTriggerDates.get(c.id)
      return {
        ...c,
        followUpTriggeredAt: trigger?.date || c.updated_at || c.created_at,
        followUpContext: trigger?.context || c.next_steps || null,
      }
    })
    .sort((a, b) => new Date(a.followUpTriggeredAt).getTime() - new Date(b.followUpTriggeredAt).getTime())

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
      <InstallPrompt />
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
            <p className="text-xs text-muted-foreground mt-1">
              90+ days since last contact
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

      {/* Follow-ups Pending */}
      <FollowUpList contacts={followUpList} nowMs={now} />

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
