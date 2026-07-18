import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
} from "@/lib/api-utils"
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
  _userId: string,
  keepId: string,
  removeId: string
): Promise<MergeResult | { error: string }> {
  if (keepId === removeId) {
    return { error: "Cannot merge a contact with itself" }
  }
  const { data, error } = await supabase.rpc("merge_owned_contacts", {
    p_keep_id: keepId,
    p_remove_id: removeId,
  })
  if (error) {
    const expected = ["Cannot merge a contact with itself", "One or both contacts not found"]
      .find((message) => error.message.includes(message))
    if (!expected) console.error("Atomic contact merge failed:", error.message)
    return { error: expected || "Merge could not be completed safely" }
  }

  const result = data as Partial<MergeResult> | null
  if (!result?.mergeLogId) return { error: "Merge could not be completed safely" }
  return {
    keepId: result.keepId || keepId,
    removeId: result.removeId || removeId,
    mergeLogId: result.mergeLogId,
    fieldsMerged: result.fieldsMerged || [],
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
      revalidatePath("/intros")

      return NextResponse.json({ merged: results, errors })
    }

    const parsed = MergeSchema.safeParse(body)
    if (!parsed.success) return badRequestResponse("Invalid contact IDs")

    const res = await performMerge(supabase, user.id, parsed.data.keepId, parsed.data.removeId)
    if ("error" in res) return badRequestResponse(res.error)

    revalidatePath("/dashboard")
    revalidatePath("/contacts")
    revalidatePath("/reach-out")
    revalidatePath("/intros")

    return NextResponse.json({ success: true, ...res })
  } catch (error) {
    console.error("Merge error:", error)
    return errorResponse("Failed to merge contacts")
  }
}
