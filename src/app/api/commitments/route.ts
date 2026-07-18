import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse, isValidUUID } from "@/lib/api-utils"

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const searchParams = new URL(request.url).searchParams
    const status = searchParams.get("status") || "active"
    const contactId = searchParams.get("contact_id")
    if (!['active', 'open', 'completed', 'cancelled', 'all'].includes(status)) {
      return badRequestResponse("Invalid commitment status")
    }
    if (contactId && !isValidUUID(contactId)) return badRequestResponse("Invalid contact ID")

    let query = supabase
      .from("commitments")
      .select("*")
      .eq("user_id", user.id)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200)

    if (status === "active") query = query.in("status", ["open", "snoozed"])
    else if (status !== "all") query = query.eq("status", status)
    if (contactId) query = query.eq("contact_id", contactId)

    const { data, error } = await query
    if (error) return errorResponse("Failed to load commitments")
    return NextResponse.json({ commitments: data || [] })
  } catch {
    return errorResponse("Failed to load commitments")
  }
}
