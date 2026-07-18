import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-utils"
import { getUserPlan } from "@/lib/subscription"

const CreateSchema = z.object({
  target_contact_id: z.string().uuid(),
  connector_contact_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000),
  path_evidence: z.string().trim().max(2000).nullable().optional(),
  path_confidence: z.enum(["verified", "possible", "context_only"]),
  strength_score: z.number().int().min(0).max(100),
  draft_message: z.string().trim().max(10000).optional(),
}).strict()

export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const [{ data: requests, error }, { data: contacts }] = await Promise.all([
      supabase
        .from("intro_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contacts")
        .select("id, name, company, job_title")
        .eq("created_by", user.id)
        .is("archived_at", null)
        .order("name"),
    ])
    if (error) return errorResponse("Could not load warm introductions")
    return NextResponse.json({ requests: requests || [], contacts: contacts || [] })
  } catch (error) {
    console.error("Intro requests GET error:", error)
    return errorResponse("Could not load warm introductions")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("create")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth
    if ((await getUserPlan(user.id)) === "free") return forbiddenResponse("Warm intro tracking is a Pro feature")

    const parsed = CreateSchema.safeParse(await request.json())
    if (!parsed.success) return badRequestResponse(parsed.error.issues[0]?.message || "Invalid introduction")
    const input = parsed.data
    if (input.target_contact_id === input.connector_contact_id) {
      return badRequestResponse("Choose a different connector and target")
    }

    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("created_by", user.id)
      .is("archived_at", null)
      .in("id", [input.target_contact_id, input.connector_contact_id])
    if (!contacts || contacts.length !== 2) return notFoundResponse("Target or connector not found")

    const target = contacts.find((contact) => contact.id === input.target_contact_id)
    const connector = contacts.find((contact) => contact.id === input.connector_contact_id)
    const defaultDraft = `Hi ${connector?.name || "there"}, would you be comfortable introducing me to ${target?.name || "this person"}? ${input.reason.trim()} No pressure at all if the relationship is not close enough for an introduction.`

    const { data: created, error } = await supabase
      .from("intro_requests")
      .insert({
        user_id: user.id,
        target_contact_id: input.target_contact_id,
        connector_contact_id: input.connector_contact_id,
        reason: input.reason,
        path_evidence: input.path_evidence || null,
        path_confidence: input.path_confidence,
        strength_score: input.strength_score,
        draft_message: input.draft_message?.trim() || defaultDraft,
      })
      .select("*")
      .single()

    if (error || !created) return errorResponse("Could not save this introduction")
    revalidatePath("/intros")
    revalidatePath("/dashboard")
    revalidatePath("/moves")
    return NextResponse.json({ request: created }, { status: 201 })
  } catch (error) {
    console.error("Intro requests POST error:", error)
    return errorResponse("Could not save this introduction")
  }
}
