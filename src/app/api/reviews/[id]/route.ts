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

const UpdateReviewSchema = z.object({
  status: z.literal("dismissed"),
}).strict()

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    if (!isValidUUID(id)) return badRequestResponse("Invalid review ID")

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const parsed = UpdateReviewSchema.safeParse(await request.json())
    if (!parsed.success) return badRequestResponse("Invalid review update")

    const { data, error } = await supabase
      .from("after_call_reviews")
      .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle()

    if (error) return errorResponse("Failed to dismiss review")
    if (!data) return notFoundResponse("Pending review not found")

    revalidatePath("/dashboard")
    revalidatePath("/moves")
    revalidatePath("/inbox")
    return NextResponse.json({ review: data })
  } catch {
    return errorResponse("Failed to dismiss review")
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    if (!isValidUUID(id)) return badRequestResponse("Invalid review ID")

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data, error } = await supabase
      .from("after_call_reviews")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()

    if (error) return errorResponse("Failed to delete transcript")
    if (!data) return notFoundResponse("Meeting review not found")

    revalidatePath("/dashboard")
    revalidatePath("/moves")
    revalidatePath("/inbox")
    return NextResponse.json({ success: true })
  } catch {
    return errorResponse("Failed to delete transcript")
  }
}
