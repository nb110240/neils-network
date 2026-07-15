export const dynamic = "force-dynamic"

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { calculateHealthScore } from "@/lib/health"
import { CONTACT_COLUMNS } from "@/lib/contact-columns"
import { getUserPlan } from "@/lib/subscription"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { HealthBadge } from "@/components/health-badge"
import { DraftMessageButton } from "@/components/draft-message-button"
import { getInitials } from "@/lib/utils"
import { ArrowLeft, HandHeart } from "lucide-react"
import type { Contact, HealthScore } from "@/lib/types"

interface ReachOutContact extends Contact {
  health: HealthScore
  reason: string
}

export default async function ReachOutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const plan = await getUserPlan(user.id)

  const { data: allContacts } = await supabase
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .eq("created_by", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })

  const contactsWithHealth = (allContacts || []).map((c) => ({
    ...c,
    health: calculateHealthScore(c.last_contact_date, c.created_at, c.cadence_days),
  }))

  const now = Date.now()
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

  function cadenceLabel(days: number): string {
    if (days === 7) return "Weekly"
    if (days === 14) return "Every 2 weeks"
    if (days === 30) return "Monthly"
    if (days === 90) return "Quarterly"
    return `Every ${days} days`
  }

  // Filter out snoozed contacts
  const isSnoozed = (c: typeof contactsWithHealth[0]) =>
    c.snoozed_until && c.snoozed_until >= todayStr
  const activeContacts = contactsWithHealth.filter((c) => !isSnoozed(c))

  // Priority 0: Scheduled contacts due today
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

  // Priority 1: follow_up_needed that aren't green (green = already healthy)
  const followUpContacts: ReachOutContact[] = activeContacts
    .filter((c) => !scheduledIds.has(c.id) && c.follow_up_needed && c.health.level !== "green")
    .sort((a, b) => new Date(a.last_contact_date || a.created_at).getTime() - new Date(b.last_contact_date || b.created_at).getTime())
    .map((c) => ({ ...c, reason: "Follow-up needed" }))

  // Priority 2: orange or red health
  const listedIds = new Set([...scheduledIds, ...followUpContacts.map((c) => c.id)])
  const coldContacts: ReachOutContact[] = activeContacts
    .filter((c) => !listedIds.has(c.id) && (c.health.level === "orange" || c.health.level === "red"))
    .sort((a, b) => new Date(a.last_contact_date || a.created_at).getTime() - new Date(b.last_contact_date || b.created_at).getTime())
    .map((c) => ({ ...c, reason: formatDaysAgo(daysSince(c.last_contact_date, c.created_at)) }))

  // Priority 3: yellow + 45+ days
  const existingIds = new Set([...scheduledContacts, ...followUpContacts, ...coldContacts].map((c) => c.id))
  const coolingContacts: ReachOutContact[] = activeContacts
    .filter((c) => !existingIds.has(c.id) && c.health.level === "yellow" && daysSince(c.last_contact_date, c.created_at) >= 45)
    .sort((a, b) => new Date(a.last_contact_date || a.created_at).getTime() - new Date(b.last_contact_date || b.created_at).getTime())
    .map((c) => ({ ...c, reason: formatDaysAgo(daysSince(c.last_contact_date, c.created_at)) }))

  const allReachOut = [...scheduledContacts, ...followUpContacts, ...coldContacts, ...coolingContacts]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-4xl font-normal tracking-tight">Reach Out Today</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          {allReachOut.length} contact{allReachOut.length !== 1 ? "s" : ""} need{allReachOut.length === 1 ? "s" : ""} your attention. Sorted by urgency.
        </p>
      </div>

      {allReachOut.length === 0 ? (
        <Card className="shadow-refined">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-950 flex items-center justify-center mb-4">
              <HandHeart className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-normal">All caught up!</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              No contacts need attention right now. Great job staying on top of your network.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-refined border-l-2 border-l-[var(--copper)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-3 text-base font-medium">
              <HandHeart className="h-4 w-4 text-[var(--copper)]" />
              {allReachOut.length} contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {allReachOut.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--copper)]/5 transition-all group"
              >
                <Link
                  href={`/contact/${contact.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-[var(--copper)]/8 text-[var(--copper)] text-xs font-medium">
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium group-hover:text-[var(--copper)] transition-colors truncate">
                        {contact.name || "Unknown Contact"}
                      </span>
                      {contact.company && (
                        <span className="text-sm text-muted-foreground truncate hidden sm:inline">
                          {contact.company}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <HealthBadge health={contact.health} />
                      <span className="text-xs text-muted-foreground">
                        {contact.reason}
                      </span>
                    </div>
                  </div>
                </Link>
                <div className="shrink-0 ml-2">
                  <DraftMessageButton
                    contactId={contact.id}
                    contactName={contact.name || "Contact"}
                    plan={plan}
                    variant="icon"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
