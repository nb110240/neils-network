import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
} from "@/lib/api-utils"
import { z } from "zod/v4"

const UndoSchema = z.object({
  mergeLogId: z.string().uuid(),
})

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { supabase } = auth

    const body = await request.json()
    const parsed = UndoSchema.safeParse(body)
    if (!parsed.success) return badRequestResponse("Invalid merge log id")

    const { error } = await supabase.rpc("undo_owned_contact_merge", {
      p_merge_log_id: parsed.data.mergeLogId,
    })
    if (error) {
      const expected = ["Merge not found", "Merge already undone", "Merge contacts are no longer available"]
        .find((message) => error.message.includes(message))
      if (!expected) console.error("Atomic merge undo failed:", error.message)
      return badRequestResponse(expected || "Merge could not be undone safely")
    }

    revalidatePath("/dashboard")
    revalidatePath("/contacts")
    revalidatePath("/reach-out")
    revalidatePath("/intros")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Merge undo error:", error)
    return errorResponse("Failed to undo merge")
  }
}
