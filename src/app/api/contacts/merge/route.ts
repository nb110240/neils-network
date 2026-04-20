import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
} from "@/lib/api-utils"
import { computeNextDueDate } from "@/lib/health"
import { z } from "zod/v4"
import type { SupabaseClient } from "@supabase/supabase-js"

const MergeSchema = z.object({
  keepId: z.string().uuid(),
  removeId: z.string().uuid(),
})

const BulkMergeSchema = z.object({
  pairs: z
    .array(z.object({ keepId: z.string().uuid(), removeId: z.string().uuid() }))
    .min(1)
    .max(50),
})

interface MergeResult {
  keepId: string
  removeId: string
  mergeLogId: string
  fieldsMerged: string[]
}

async function performMerge(
  supabase: SupabaseClient,
  userId: string,
  keepId: string,
  removeId: string
): Promise<MergeResult | { error: string }> {
  if (keepId === removeId) {
    return { error: "Cannot merge a contact with itself" }
  }

  const { data: keepContact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", keepId)
    .eq("created_by", userId)
    .is("archived_at", null)
    .single()

  const { data: removeContact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", removeId)
    .eq("created_by", userId)
    .is("archived_at", null)
    .single()

  if (!keepContact || !removeContact) {
    return { error: "One or both contacts not found" }
  }

  const updates: Record<string, unknown> = {}
  const fieldsToMerge = [
    "email",
    "phone",
    "company",
    "job_title",
    "website",
    "how_we_met",
    "next_steps",
  ] as const
  for (const field of fieldsToMerge) {
    if (!keepContact[field] && removeContact[field]) {
      updates[field] = removeContact[field]
    }
  }

  if (removeContact.last_contact_date) {
    if (
      !keepContact.last_contact_date ||
      removeContact.last_contact_date > keepContact.last_contact_date
    ) {
      updates.last_contact_date = removeContact.last_contact_date
    }
  }

  if (!keepContact.cadence_days && removeContact.cadence_days) {
    updates.cadence_days = removeContact.cadence_days
  }
  if (!keepContact.scheduled_follow_up && removeContact.scheduled_follow_up) {
    updates.scheduled_follow_up = removeContact.scheduled_follow_up
  }

  if (removeContact.raw_note && removeContact.raw_note !== keepContact.raw_note) {
    updates.raw_note = `${keepContact.raw_note}\n\n---\n\nMerged from duplicate:\n${removeContact.raw_note}`
  }

  if (Object.keys(updates).length > 0) {
    const newLastContact =
      (updates.last_contact_date as string) || keepContact.last_contact_date
    const newCadence =
      (updates.cadence_days as number) || keepContact.cadence_days
    const newFollowUp =
      (updates.scheduled_follow_up as string) || keepContact.scheduled_follow_up
    updates.next_due_date = computeNextDueDate(
      newLastContact,
      keepContact.created_at,
      newCadence,
      newFollowUp
    )

    await supabase
      .from("contacts")
      .update(updates)
      .eq("id", keepId)
      .eq("created_by", userId)
  }

  const { data: movedActivities } = await supabase
    .from("contact_activities")
    .select("id")
    .eq("contact_id", removeId)
    .eq("user_id", userId)

  const movedActivityIds = (movedActivities ?? []).map((a) => a.id as string)

  if (movedActivityIds.length > 0) {
    await supabase
      .from("contact_activities")
      .update({ contact_id: keepId })
      .eq("contact_id", removeId)
      .eq("user_id", userId)
  }

  const { data: keepTags } = await supabase
    .from("contact_tags")
    .select("tag_id")
    .eq("contact_id", keepId)
  const keepTagIds = new Set((keepTags || []).map((t) => t.tag_id))

  const { data: removeTags } = await supabase
    .from("contact_tags")
    .select("tag_id")
    .eq("contact_id", removeId)

  const movedTagIds: string[] = []
  for (const tag of removeTags || []) {
    if (!keepTagIds.has(tag.tag_id)) {
      await supabase
        .from("contact_tags")
        .insert({ contact_id: keepId, tag_id: tag.tag_id })
      movedTagIds.push(tag.tag_id as string)
    }
  }

  await supabase
    .from("contacts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", removeId)
    .eq("created_by", userId)

  const { data: logRow } = await supabase
    .from("merge_log")
    .insert({
      user_id: userId,
      kept_contact_id: keepId,
      removed_contact_id: removeId,
      kept_before: keepContact,
      removed_before: removeContact,
      moved_activity_ids: movedActivityIds,
      moved_tag_ids: movedTagIds,
      fields_merged: Object.keys(updates),
    })
    .select("id")
    .single()

  return {
    keepId,
    removeId,
    mergeLogId: logRow?.id as string,
    fieldsMerged: Object.keys(updates),
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()

    if (body && typeof body === "object" && "pairs" in body) {
      const parsed = BulkMergeSchema.safeParse(body)
      if (!parsed.success) return badRequestResponse("Invalid bulk merge payload")

      const results: MergeResult[] = []
      const errors: Array<{ keepId: string; removeId: string; error: string }> = []
      for (const { keepId, removeId } of parsed.data.pairs) {
        const res = await performMerge(supabase, user.id, keepId, removeId)
        if ("error" in res) {
          errors.push({ keepId, removeId, error: res.error })
        } else {
          results.push(res)
        }
      }

      revalidatePath("/dashboard")
      revalidatePath("/contacts")
      revalidatePath("/reach-out")

      return NextResponse.json({ merged: results, errors })
    }

    const parsed = MergeSchema.safeParse(body)
    if (!parsed.success) return badRequestResponse("Invalid contact IDs")

    const res = await performMerge(supabase, user.id, parsed.data.keepId, parsed.data.removeId)
    if ("error" in res) return badRequestResponse(res.error)

    revalidatePath("/dashboard")
    revalidatePath("/contacts")
    revalidatePath("/reach-out")

    return NextResponse.json({ success: true, ...res })
  } catch (error) {
    console.error("Merge error:", error)
    return errorResponse("Failed to merge contacts")
  }
}
