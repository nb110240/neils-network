import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse, forbiddenResponse } from "@/lib/api-utils"
import { createServiceClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"

const VALID_FREQUENCIES = ["daily", "weekly", "never"] as const

export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const serviceSupabase = await createServiceClient()
    const { data } = await serviceSupabase
      .from("user_preferences")
      .select("digest_frequency")
      .eq("user_id", user.id)
      .single()

    const plan = await getUserPlan(user.id)
    const savedFrequency = data?.digest_frequency || "weekly"

    return NextResponse.json({
      digest_frequency: plan === "free" && savedFrequency === "daily" ? "weekly" : savedFrequency,
      can_use_daily: plan !== "free",
    })
  } catch (error) {
    console.error("Notification preferences GET error:", error)
    return errorResponse("Internal server error")
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const body = await request.json()
    const { digest_frequency } = body

    if (!digest_frequency || !VALID_FREQUENCIES.includes(digest_frequency)) {
      return badRequestResponse("Invalid digest_frequency. Must be: daily, weekly, or never")
    }

    const plan = await getUserPlan(user.id)
    if (plan === "free" && digest_frequency === "daily") {
      return forbiddenResponse("Daily digests are a Pro feature")
    }

    const serviceSupabase = await createServiceClient()
    const { error } = await serviceSupabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          digest_frequency,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (error) {
      console.error("Failed to update preferences:", error)
      return errorResponse("Failed to save preferences")
    }

    return NextResponse.json({ digest_frequency })
  } catch (error) {
    console.error("Notification preferences PUT error:", error)
    return errorResponse("Internal server error")
  }
}
