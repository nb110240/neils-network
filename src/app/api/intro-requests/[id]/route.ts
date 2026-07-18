import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
  isValidUUID,
  notFoundResponse,
} from "@/lib/api-utils"

const StatusSchema = z.enum(["draft", "requested", "accepted", "introduced", "meeting_booked", "closed", "declined"])
const PatchSchema = z.object({
  status: StatusSchema.optional(),
  draft_message: z.string().trim().min(1).max(10000).optional(),
  next_follow_up_at: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Add a change")

function statusPatch(status: z.infer<typeof StatusSchema>, now: Date) {
  const iso = now.toISOString()
  const future = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
  if (status === "requested") return { requested_at: iso, next_follow_up_at: future(5) }
  if (status === "accepted") return { accepted_at: iso, next_follow_up_at: future(3) }
  if (status === "introduced") return { introduced_at: iso, next_follow_up_at: future(7) }
  if (status === "meeting_booked") return { meeting_booked_at: iso, next_follow_up_at: null }
  if (status === "closed" || status === "declined") return { closed_at: iso, next_follow_up_at: null }
  return {}
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isValidUUID(id)) return badRequestResponse("Invalid introduction ID")
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth
    const parsed = PatchSchema.safeParse(await request.json())
    if (!parsed.success) return badRequestResponse(parsed.error.issues[0]?.message || "Invalid update")

    const updates: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.status) Object.assign(updates, statusPatch(parsed.data.status, new Date()))
    if ("next_follow_up_at" in parsed.data) updates.next_follow_up_at = parsed.data.next_follow_up_at
    const { data: updated, error } = await supabase
      .from("intro_requests")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle()
    if (error) return errorResponse("Could not update this introduction")
    if (!updated) return notFoundResponse("Introduction not found")

    revalidatePath("/intros")
    revalidatePath("/dashboard")
    revalidatePath("/moves")
    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error("Intro request PATCH error:", error)
    return errorResponse("Could not update this introduction")
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isValidUUID(id)) return badRequestResponse("Invalid introduction ID")
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth
    const { data: deleted, error } = await supabase
      .from("intro_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()
    if (error) return errorResponse("Could not delete this introduction")
    if (!deleted) return notFoundResponse("Introduction not found")
    revalidatePath("/intros")
    revalidatePath("/dashboard")
    revalidatePath("/moves")
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("Intro request DELETE error:", error)
    return errorResponse("Could not delete this introduction")
  }
}
