import { NextResponse } from "next/server"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
} from "@/lib/api-utils"
import { z } from "zod/v4"

const DismissSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(2).max(20),
})

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()
    const parsed = DismissSchema.safeParse(body)
    if (!parsed.success) return badRequestResponse("Invalid contact IDs")

    const ids = [...new Set(parsed.data.contactIds)]
    const rows: Array<{
      user_id: string
      contact_a_id: string
      contact_b_id: string
    }> = []

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]]
        rows.push({ user_id: user.id, contact_a_id: a, contact_b_id: b })
      }
    }

    const { error } = await supabase
      .from("not_duplicate_pairs")
      .upsert(rows, { onConflict: "user_id,contact_a_id,contact_b_id", ignoreDuplicates: true })

    if (error) {
      console.error("Dismiss error:", error)
      return errorResponse("Failed to dismiss")
    }

    return NextResponse.json({ success: true, dismissed: rows.length })
  } catch (error) {
    console.error("Dismiss error:", error)
    return errorResponse("Failed to dismiss")
  }
}
