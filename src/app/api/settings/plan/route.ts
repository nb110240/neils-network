import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { getUserPlan } from "@/lib/subscription"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const plan = await getUserPlan(user.id)

    const serviceSupabase = await createServiceClient()
    const { count } = await serviceSupabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("created_by", user.id)
      .is("archived_at", null)

    return NextResponse.json({
      plan,
      contactCount: count || 0,
    })
  } catch (error) {
    console.error("Settings plan error:", error)
    return errorResponse("Internal server error")
  }
}
