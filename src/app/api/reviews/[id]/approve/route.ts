import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod/v4"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
  isValidUUID,
  notFoundResponse,
} from "@/lib/api-utils"
import { buildContactEmbeddingText, generateEmbedding } from "@/lib/openai"
import { log } from "@/lib/logger"

const OptionalText = z.string().trim().max(1000).nullable().optional()

const ApproveReviewSchema = z.object({
  contact_id: z.string().uuid().nullable().optional(),
  contact_patch: z.object({
    name: z.string().trim().min(1).max(200).nullable().optional(),
    email: z.union([z.string().trim().email().max(320), z.literal(""), z.null()]).optional(),
    company: z.string().trim().max(200).nullable().optional(),
    job_title: z.string().trim().max(200).nullable().optional(),
    how_we_met: z.string().trim().max(500).nullable().optional(),
    next_steps: OptionalText,
  }).strict(),
  commitments: z.array(z.object({
    title: z.string().trim().min(1).max(500),
    direction: z.enum(["user_owes", "contact_owes"]),
    details: z.string().trim().max(4000).nullable(),
    due_at: z.string().datetime({ offset: true }).nullable(),
    evidence: z.string().trim().max(2000).nullable(),
    confidence: z.number().min(0).max(1),
    priority: z.number().int().min(0).max(100),
  }).strict()).max(20),
  follow_up_draft: z.string().trim().max(10000).nullable(),
}).strict()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!isValidUUID(id)) return badRequestResponse("Invalid review ID")

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const parsed = ApproveReviewSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequestResponse(parsed.error.issues[0]?.message || "Invalid review changes")
    }

    const { data: review } = await supabase
      .from("after_call_reviews")
      .select("id, status, contact_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!review) return notFoundResponse("Meeting review not found")
    if (review.status === "dismissed") return badRequestResponse("Dismissed reviews cannot be approved")

    const resolvedContactId = parsed.data.contact_id ?? review.contact_id
    if (resolvedContactId) {
      const { data: ownedContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("id", resolvedContactId)
        .eq("created_by", user.id)
        .is("archived_at", null)
        .maybeSingle()
      if (!ownedContact) return notFoundResponse("Contact not found")
    } else if (!parsed.data.contact_patch.name) {
      return badRequestResponse("Add the contact's name before approving")
    }

    if (review.status === "pending") {
      const { error: updateError } = await supabase
        .from("after_call_reviews")
        .update({
          contact_id: resolvedContactId || null,
          proposed_contact_patch: parsed.data.contact_patch,
          proposed_commitments: parsed.data.commitments,
          proposed_follow_up: parsed.data.follow_up_draft,
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "pending")

      if (updateError) return errorResponse("Failed to save review changes")
    }

    const { data: rpcResult, error: rpcError } = await supabase
      .rpc("approve_after_call_review", { p_review_id: id })

    if (rpcError) {
      const isUserError = /required|not found|pending/i.test(rpcError.message || "")
      return isUserError
        ? badRequestResponse("Review could not be approved. Check the contact and actions.")
        : errorResponse("Failed to approve meeting review")
    }

    const result = rpcResult as {
      contact_id?: string
      commitments_created?: number
      already_approved?: boolean
    } | null
    const contactId = result?.contact_id

    if (contactId && !result?.already_approved) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("name, email, company, job_title, how_we_met, next_steps, raw_note")
        .eq("id", contactId)
        .eq("created_by", user.id)
        .is("archived_at", null)
        .maybeSingle()

      if (contact) {
        const embedding = await generateEmbedding(buildContactEmbeddingText(contact))
        await supabase
          .from("contacts")
          .update({
            embedding: embedding || null,
            embedding_status: embedding ? "complete" : "failed",
          })
          .eq("id", contactId)
          .eq("created_by", user.id)
      }
    }

    revalidatePath("/dashboard")
    revalidatePath("/moves")
    revalidatePath("/inbox")
    revalidatePath("/contacts")
    if (contactId) revalidatePath(`/contact/${contactId}`)

    log("info", "after-call review approved", {
      action: "review.approve",
      route: `/api/reviews/${id}/approve`,
      userId: user.id,
      reviewId: id,
      contactId,
      commitmentsCreated: result?.commitments_created || 0,
      alreadyApproved: result?.already_approved || false,
    })

    return NextResponse.json({ result })
  } catch (error) {
    log("error", "after-call review approval failed", {
      action: "review.approve",
      error: error instanceof Error ? error.message : String(error),
    })
    return errorResponse("Failed to approve meeting review")
  }
}
