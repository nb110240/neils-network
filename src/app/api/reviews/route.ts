import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const status = new URL(request.url).searchParams.get("status") || "pending"
    if (!['pending', 'approved', 'dismissed', 'all'].includes(status)) {
      return badRequestResponse("Invalid review status")
    }

    let query = supabase
      .from("after_call_reviews")
      .select("*")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(100)

    if (status !== "all") query = query.eq("status", status)

    const { data, error } = await query
    if (error) return errorResponse("Failed to load meeting reviews")
    return NextResponse.json({ reviews: data || [] })
  } catch {
    return errorResponse("Failed to load meeting reviews")
  }
}
