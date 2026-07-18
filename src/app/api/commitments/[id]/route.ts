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

const UpdateCommitmentSchema = z.object({
  status: z.enum(["open", "completed", "snoozed", "cancelled"]).optional(),
  snoozed_until: z.string().datetime({ offset: true }).nullable().optional(),
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
  title: z.string().trim().min(1).max(500).optional(),
}).strict().refine(
  (value) => value.status !== "snoozed" || Boolean(value.snoozed_until),
  { message: "Choose when to show this action again" }
)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!isValidUUID(id)) return badRequestResponse("Invalid commitment ID")

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const parsed = UpdateCommitmentSchema.safeParse(await request.json())
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
      return badRequestResponse(parsed.success ? "No changes provided" : parsed.error.issues[0]?.message || "Invalid update")
    }

    const updates: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.status === "completed") {
      updates.completed_at = new Date().toISOString()
      updates.snoozed_until = null
    } else if (parsed.data.status === "open") {
      updates.completed_at = null
      updates.snoozed_until = null
    } else if (parsed.data.status === "cancelled") {
      updates.completed_at = null
      updates.snoozed_until = null
    }

    const { data, error } = await supabase
      .from("commitments")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle()

    if (error) return errorResponse("Failed to update action")
    if (!data) return notFoundResponse("Action not found")

    revalidatePath("/dashboard")
    revalidatePath("/moves")
    revalidatePath("/contacts")
    revalidatePath(`/contact/${data.contact_id}`)
    return NextResponse.json({ commitment: data })
  } catch {
    return errorResponse("Failed to update action")
  }
}
