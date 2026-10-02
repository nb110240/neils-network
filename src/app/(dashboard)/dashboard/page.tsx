export const dynamic = "force-dynamic"

import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"

import { calculateHealthScore } from "@/lib/health"
import { CONTACT_COLUMNS } from "@/lib/contact-columns"
import { getPlanLimits, getUserPlan } from "@/lib/subscription"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContactCard } from "@/components/contact-card"
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
import { NextMoves } from "@/components/next-moves"
import { fetchArchivedContactIds } from "@/lib/archived-contacts"
import { buildNextMoves } from "@/lib/next-moves"
import type { AfterCallReview, Commitment, IntroRequest } from "@/lib/types"
import { Plus, Users, ArrowRight, ThermometerSnowflake, Crown } from "lucide-react"

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
  const [
    plan,
    { data: allContacts },
    { data: commitmentRows },
    { data: reviewRows },
    { data: introRows },
    { count: reviewCount },
    { count: commitmentCount },
    archivedContactIds,
  ] = await Promise.all([
    getUserPlan(user.id),
    supabase
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("created_by", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    // Only open work feeds the action list (same filters as /moves).
    supabase
      .from("commitments")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["open", "snoozed"]),
    supabase
      .from("after_call_reviews")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("occurred_at", { ascending: false }),
    supabase
      .from("intro_requests")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["draft", "requested", "accepted", "introduced"]),
    // Lifetime counts drive onboarding progress, so fetch counts, not rows.
    supabase
      .from("after_call_reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("commitments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    fetchArchivedContactIds(supabase, user.id),
  ])

  const totalContacts = allContacts?.length ?? 0
  const planLimits = getPlanLimits(plan)

  // Check if calendar is connected for plans that include calendar sync.
  let calendarConnected = false
  if (planLimits.canCalendarSync) {
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

  const commitments = (commitmentRows || []) as Commitment[]
  const reviews = (reviewRows || []) as AfterCallReview[]
  const introRequests = (introRows || []) as IntroRequest[]
  const now = new Date().getTime()
  const nextMoves = buildNextMoves({
    commitments,
    reviews,
    introRequests,
    contacts: allContacts || [],
    archivedContactIds,
    nowMs: now,
  })
  const goingColdCount = contactsWithHealth.filter((c) => c.health.level === "orange" || c.health.level === "red").length

  const recentContacts = contactsWithHealth.slice(0, 6)
  const isEmpty = (allContacts || []).length === 0 && (reviewCount ?? 0) === 0

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
      <OnboardingChecklist
        contactCount={totalContacts || 0}
        calendarConnected={calendarConnected}
        reviewCount={reviewCount ?? 0}
        pendingReviewCount={reviews.length}
        actionCount={commitmentCount ?? 0}
        moveCount={nextMoves.length}
        plan={plan}
      />
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
          {planLimits.canCalendarSync && (
            <CalendarConnectButton isConnected={calendarConnected} />
          )}
          {plan === "free" ? (
            <Button variant="outline" size="sm" asChild className="border-[var(--copper)]/30 text-[var(--copper-text)] hover:bg-[var(--copper)]/5">
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

      <NextMoves moves={nextMoves} plan={plan} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 stagger-children">
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

        <Card className="shadow-refined" data-tour="stats-cold">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Going Cold</CardTitle>
            <ThermometerSnowflake className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-normal whitespace-nowrap">{goingColdCount}</div>
            <p className="text-sm text-muted-foreground mt-1">
              overdue for a check-in
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-refined col-span-2 lg:col-span-1">
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
            <Button variant="outline" size="sm" className="w-full justify-between group" asChild>
              <Link href="/import">
                Import Contacts
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
            </Button>
            {planLimits.canImport && <StartEventButton />}
          </CardContent>
        </Card>
      </div>

      {/* Recent Contacts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-normal">Recent Contacts</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[var(--copper-text)]" asChild>
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
                <Users className="h-6 w-6 text-[var(--copper-text)]" />
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
