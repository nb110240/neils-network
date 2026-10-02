export const dynamic = "force-dynamic"

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import { buildNextMoves, relationshipMoves } from "@/lib/next-moves"
import { NextMoves } from "@/components/next-moves"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { AfterCallReview, Commitment, IntroRequest } from "@/lib/types"

/**
 * People-only view of the unified action list: the relationship moves from
 * buildNextMoves, in the same order the dashboard and /moves show them.
 * Contacts whose next move is a promise, review, or intro live on /moves.
 */
export default async function ReachOutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [plan, { data: contacts }, { data: commitments }, { data: reviews }, { data: introRequests }] = await Promise.all([
    getUserPlan(user.id),
    supabase
      .from("contacts")
      .select("id, name, company, next_steps, follow_up_needed, next_due_date, snoozed_until, last_contact_date, cadence_days, created_at")
      .eq("created_by", user.id)
      .is("archived_at", null),
    supabase
      .from("commitments")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["open", "snoozed"]),
    supabase
      .from("after_call_reviews")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("intro_requests")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["draft", "requested", "accepted", "introduced"]),
  ])

  const people = relationshipMoves(buildNextMoves({
    contacts: contacts || [],
    commitments: (commitments || []) as Commitment[],
    reviews: (reviews || []) as AfterCallReview[],
    introRequests: (introRequests || []) as IntroRequest[],
  }))

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-normal tracking-tight">Reach Out Today</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            {people.length === 0
              ? "No one needs a nudge right now."
              : `${people.length} ${people.length === 1 ? "person needs" : "people need"} your attention, most urgent first.`}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="min-h-11 self-start sm:self-auto text-muted-foreground hover:text-[var(--copper-text)]" asChild>
          <Link href="/moves">All moves</Link>
        </Button>
      </div>

      <NextMoves
        moves={people}
        limit={null}
        plan={plan}
        showHeader={false}
        emptyTitle="All caught up"
        emptyDescription="No one needs attention right now. Great job staying on top of your network."
      />
    </div>
  )
}
