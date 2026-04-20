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

const RESTORABLE_FIELDS = [
  "email",
  "phone",
  "company",
  "job_title",
  "website",
  "how_we_met",
  "next_steps",
  "raw_note",
  "last_contact_date",
  "cadence_days",
  "scheduled_follow_up",
  "next_due_date",
] as const

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()
    const parsed = UndoSchema.safeParse(body)
    if (!parsed.success) return badRequestResponse("Invalid merge log id")

    const { data: log } = await supabase
      .from("merge_log")
      .select("*")
      .eq("id", parsed.data.mergeLogId)
      .eq("user_id", user.id)
      .single()

    if (!log) return badRequestResponse("Merge not found")
    if (log.undone_at) return badRequestResponse("Merge already undone")

    const keptBefore = log.kept_before as Record<string, unknown>
    const removedBefore = log.removed_before as Record<string, unknown>

    const keptRestore: Record<string, unknown> = {}
    for (const field of RESTORABLE_FIELDS) {
      keptRestore[field] = keptBefore[field] ?? null
    }

    await supabase
      .from("contacts")
      .update(keptRestore)
      .eq("id", log.kept_contact_id)
      .eq("created_by", user.id)

    const movedActivityIds = (log.moved_activity_ids as string[] | null) ?? []
    if (movedActivityIds.length > 0) {
      await supabase
        .from("contact_activities")
        .update({ contact_id: log.removed_contact_id })
        .in("id", movedActivityIds)
        .eq("user_id", user.id)
    }

    const movedTagIds = (log.moved_tag_ids as string[] | null) ?? []
    if (movedTagIds.length > 0) {
      await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", log.kept_contact_id)
        .in("tag_id", movedTagIds)

      for (const tagId of movedTagIds) {
        await supabase.from("contact_tags").insert({
          contact_id: log.removed_contact_id,
          tag_id: tagId,
        })
      }
    }

    const removedRestore: Record<string, unknown> = { archived_at: null }
    for (const field of RESTORABLE_FIELDS) {
      if (field in removedBefore) removedRestore[field] = removedBefore[field] ?? null
    }

    await supabase
      .from("contacts")
      .update(removedRestore)
      .eq("id", log.removed_contact_id)
      .eq("created_by", user.id)

    await supabase
      .from("merge_log")
      .update({ undone_at: new Date().toISOString() })
      .eq("id", log.id)
      .eq("user_id", user.id)

    revalidatePath("/dashboard")
    revalidatePath("/contacts")
    revalidatePath("/reach-out")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Merge undo error:", error)
    return errorResponse("Failed to undo merge")
  }
}
