export const dynamic = "force-dynamic"

import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { fetchArchivedContactIds } from "@/lib/archived-contacts"
import { buildNextMoves } from "@/lib/next-moves"
import { getUserPlan } from "@/lib/subscription"
import { NextMoves } from "@/components/next-moves"
import { Button } from "@/components/ui/button"
import type { AfterCallReview, Commitment, IntroRequest } from "@/lib/types"

export default async function MovesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [plan, { data: contacts }, { data: commitments }, { data: reviews }, { data: introRequests }, archivedContactIds] = await Promise.all([
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
    fetchArchivedContactIds(supabase, user.id),
  ])

  const moves = buildNextMoves({
    contacts: contacts || [],
    commitments: (commitments || []) as Commitment[],
    reviews: (reviews || []) as AfterCallReview[],
    introRequests: (introRequests || []) as IntroRequest[],
    archivedContactIds,
  })

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div className="animate-fade-in">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">Your next moves</h1>
            <p className="mt-1 text-base text-muted-foreground sm:text-lg">Every open promise, review, and relationship action in priority order.</p>
          </div>
          <Button asChild className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] border-0">
            <Link href="/capture"><Plus className="mr-2 h-4 w-4" /> Capture meeting</Link>
          </Button>
        </div>
      </div>
      <NextMoves
        moves={moves}
        limit={null}
        plan={plan}
        heading="All moves"
        description="Ranked by urgency and what you promised."
      />
    </div>
  )
}
