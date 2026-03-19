import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { Contact } from "@/lib/types"
import { calculateHealthScore } from "@/lib/health"
import { getUserPlan } from "@/lib/subscription"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContactCard } from "@/components/contact-card"
import { FollowUpList } from "@/components/follow-up-list"
import { HealthBadge } from "@/components/health-badge"
import { CalendarConnectButton } from "@/components/calendar-connect-button"
import { ManageSubscriptionButton } from "@/components/manage-subscription-button"
import { UpgradeToast } from "@/components/upgrade-toast"
import { EventModeBanner } from "@/components/event-mode-banner"
import { StartEventButton } from "@/components/start-event-button"
import { Plus, Users, AlertCircle, ArrowRight, ThermometerSnowflake, Crown } from "lucide-react"

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

  const { data: followUps } = await supabase
    .from("contacts")
    .select("*")
    .eq("created_by", user.id)
    .eq("follow_up_needed", true)
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: allContacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })

  // Calculate health scores for all contacts
  const contactsWithHealth = (allContacts || []).map((c) => ({
    ...c,
    health: calculateHealthScore(c.last_contact_date, c.created_at),
  }))

  // Contacts going cold (orange or red)
  const goingCold = contactsWithHealth.filter(
    (c) => c.health.level === "orange" || c.health.level === "red"
  )

  const recentContacts = contactsWithHealth.slice(0, 6)
  const isEmpty = (allContacts || []).length === 0

  // Empty state for new users
  if (isEmpty) {
    return (
      <div className="space-y-8">
        <Suspense fallback={null}>
          <UpgradeToast />
        </Suspense>
        <div className="flex flex-col items-center justify-center py-20 max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--copper)]/10 flex items-center justify-center mb-6">
            <Users className="h-8 w-8 text-[var(--copper)]" />
          </div>
          <h1 className="text-3xl font-normal tracking-tight mb-2">Welcome to Savvo</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Your network is empty. Add your first contact to get started — just describe someone you know.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button asChild className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0 h-12 px-8 text-base">
              <Link href="/add">
                <Plus className="mr-2 h-5 w-5" />
                Add Your First Contact
              </Link>
            </Button>
            {plan === "pro" && (
              <Button variant="outline" asChild className="h-12 px-6 text-base">
                <Link href="/import">
                  Import Contacts
                </Link>
              </Button>
            )}
          </div>
          <div className="mt-12 w-full p-5 rounded-xl border border-dashed text-left">
            <p className="text-sm font-medium mb-2">Try typing something like:</p>
            <p className="text-sm text-muted-foreground italic">
              &quot;Met John at the AI Summit. He&apos;s VP of Engineering at SersweAI. We talked about their platform and should grab coffee next week.&quot;
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <UpgradeToast />
      </Suspense>
      <EventModeBanner />
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="text-4xl font-normal tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Welcome back. Here&apos;s your network overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button asChild className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 shadow-md hover:shadow-lg border-0">
            <Link href="/add">
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

        <Card className="shadow-refined">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Follow-ups</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-normal whitespace-nowrap">{followUps?.length || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              need attention
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-refined">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Going Cold</CardTitle>
            <ThermometerSnowflake className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-normal whitespace-nowrap">{goingCold.length}</div>
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

      {/* Going Cold Alert */}
      {goingCold.length > 0 && (
        <Card className="shadow-refined border-red-200 dark:border-red-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg font-normal">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <ThermometerSnowflake className="h-4 w-4 text-red-500" />
              </div>
              Relationships Going Cold
              <span className="inline-flex items-center rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                {goingCold.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {goingCold.slice(0, 5).map((contact) => (
              <Link
                key={contact.id}
                href={`/contact/${contact.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium group-hover:text-[var(--copper)] transition-colors flex items-center gap-2">
                    {contact.name || "Unknown Contact"}
                    <HealthBadge health={contact.health} />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {contact.company || ""}
                    {contact.last_contact_date
                      ? ` \u00B7 Last contact: ${new Date(contact.last_contact_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : " \u00B7 Never contacted"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
            {goingCold.length > 5 && (
              <div className="pt-2 text-center">
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                  <Link href="/contacts">View all {goingCold.length} cold contacts</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Follow-ups */}
      {followUps && followUps.length > 0 && (
        <div>
          <FollowUpList contacts={followUps as Contact[]} />
        </div>
      )}

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentContacts.map((contact, index) => (
              <div key={contact.id}>
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
