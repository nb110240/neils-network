import { NextResponse } from "next/server"
import { z } from "zod/v4"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-utils"
import { analyzeInteraction } from "@/lib/action-extraction"
import { getUserPlan } from "@/lib/subscription"
import { log } from "@/lib/logger"
import { hashMeetingContent } from "@/lib/meeting-content"
import { createServiceClient } from "@/lib/supabase/server"

const FREE_REVIEW_LIMIT = 3

const AnalyzeReviewSchema = z.object({
  contact_id: z.string().uuid().nullable().optional(),
  source: z.enum(["manual", "calendar", "granola", "forwarded_email"]).default("manual"),
  external_source_id: z.string().min(1).max(500).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  occurred_at: z.string().datetime({ offset: true }),
  raw_text: z.string().trim().min(20, "Add a little more meeting context").max(100000),
}).strict()

export async function POST(request: Request) {
  let allowanceService: Awaited<ReturnType<typeof createServiceClient>> | null = null
  let allowanceReserved = false
  let allowanceUserId: string | null = null
  try {
    const auth = await authenticateRequest("ai")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const parsed = AnalyzeReviewSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequestResponse(parsed.error.issues[0]?.message || "Invalid meeting notes")
    }

    const input = parsed.data
    const plan = await getUserPlan(user.id)
    const isFreePlan = plan === "free"

    let existingContact: {
      name: string | null
      email: string | null
      company: string | null
      job_title: string | null
      how_we_met: string | null
      next_steps: string | null
    } | null = null

    if (input.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("name, email, company, job_title, how_we_met, next_steps")
        .eq("id", input.contact_id)
        .eq("created_by", user.id)
        .is("archived_at", null)
        .maybeSingle()

      if (!contact) return notFoundResponse("Contact not found")
      existingContact = contact
    }

    const contentHash = hashMeetingContent(input.raw_text)
    const { data: existingReview } = await supabase
      .from("after_call_reviews")
      .select("*")
      .eq("user_id", user.id)
      .eq("content_hash", contentHash)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingReview) {
      return NextResponse.json({ review: existingReview, deduplicated: true })
    }

    if (isFreePlan) {
      allowanceService = await createServiceClient()
      allowanceUserId = user.id
      const { data: reservation, error: reservationError } = await allowanceService.rpc(
        "reserve_free_ai_review",
        { target_user_id: user.id, limit_count: FREE_REVIEW_LIMIT }
      )
      if (reservationError) return errorResponse("Meeting review allowance is not ready yet")
      if (!(reservation as { allowed?: boolean } | null)?.allowed) {
        return forbiddenResponse("Free accounts include three AI meeting reviews. Upgrade for unlimited reviews.")
      }
      allowanceReserved = true
    }

    const analysis = await analyzeInteraction({
      rawText: input.raw_text,
      title: input.title,
      occurredAt: input.occurred_at,
      existingContact,
      userName: user.email?.split("@")[0] || null,
    })

    const { data: review, error } = await supabase
      .from("after_call_reviews")
      .insert({
        user_id: user.id,
        contact_id: input.contact_id || null,
        source: input.source,
        external_source_id: input.external_source_id || null,
        title: input.title,
        occurred_at: input.occurred_at,
        raw_text: input.raw_text,
        content_hash: contentHash,
        summary: analysis.summary,
        proposed_contact_patch: analysis.contactPatch,
        proposed_commitments: analysis.commitments,
        proposed_follow_up: analysis.followUpDraft,
      })
      .select("*")
      .single()

    if (error || !review) {
      if (allowanceReserved && allowanceService) {
        await allowanceService.rpc("refund_free_ai_review", { target_user_id: user.id })
        allowanceReserved = false
      }
      if (error?.code === "23505" && input.external_source_id) {
        const { data: duplicate } = await supabase
          .from("after_call_reviews")
          .select("*")
          .eq("user_id", user.id)
          .eq("source", input.source)
          .eq("external_source_id", input.external_source_id)
          .maybeSingle()
        if (duplicate) return NextResponse.json({ review: duplicate, deduplicated: true })
      }
      log("error", "after-call review insert failed", {
        action: "review.analyze",
        route: "/api/reviews/analyze",
        userId: user.id,
        error: error?.message || "missing review",
      })
      return errorResponse("Failed to save meeting review")
    }

    allowanceReserved = false

    log("info", "after-call review analyzed", {
      action: "review.analyze",
      route: "/api/reviews/analyze",
      userId: user.id,
      reviewId: review.id,
      commitmentCount: analysis.commitments.length,
      source: input.source,
    })

    return NextResponse.json({ review, deduplicated: false }, { status: 201 })
  } catch (error) {
    if (allowanceReserved && allowanceService && allowanceUserId) {
      try {
        await allowanceService.rpc("refund_free_ai_review", { target_user_id: allowanceUserId })
      } catch {
        // Preserve the original request error; the failed refund is logged below.
      }
    }
    log("error", "after-call review analysis failed", {
      action: "review.analyze",
      route: "/api/reviews/analyze",
      error: error instanceof Error ? error.message : String(error),
    })
    return errorResponse("Could not analyze these notes. Please try again.")
  }
}
