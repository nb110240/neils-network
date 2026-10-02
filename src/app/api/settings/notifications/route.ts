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
      .select("digest_frequency, push_enabled")
      .eq("user_id", user.id)
      .single()

    const plan = await getUserPlan(user.id)
    const savedFrequency = data?.digest_frequency || "weekly"

    return NextResponse.json({
      digest_frequency: plan === "free" && savedFrequency === "daily" ? "weekly" : savedFrequency,
      can_use_daily: plan !== "free",
      push_enabled: data?.push_enabled !== false,
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

    const body = ((await request.json().catch(() => null)) ?? {}) as {
      digest_frequency?: unknown
      push_enabled?: unknown
    }
    const { digest_frequency, push_enabled } = body
    const hasFrequency = digest_frequency !== undefined
    const hasPush = push_enabled !== undefined

    if (!hasFrequency && !hasPush) {
      return badRequestResponse("Invalid digest_frequency. Must be: daily, weekly, or never")
    }
    if (hasFrequency && !VALID_FREQUENCIES.includes(digest_frequency as (typeof VALID_FREQUENCIES)[number])) {
      return badRequestResponse("Invalid digest_frequency. Must be: daily, weekly, or never")
    }
    if (hasPush && typeof push_enabled !== "boolean") {
      return badRequestResponse("push_enabled must be true or false")
    }

    if (hasFrequency && digest_frequency === "daily" && (await getUserPlan(user.id)) === "free") {
      return forbiddenResponse("Daily digests are a Pro feature")
    }

    const serviceSupabase = await createServiceClient()

    // A push-only change must not reset the digest: the column defaults to
    // "daily", so a first-time row would silently switch Pro users from the
    // weekly default to daily emails.
    let frequency = digest_frequency as string | undefined
    if (!hasFrequency) {
      const { data: existing } = await serviceSupabase
        .from("user_preferences")
        .select("digest_frequency")
        .eq("user_id", user.id)
        .maybeSingle()
      frequency = existing?.digest_frequency || "weekly"
    }

    const { error } = await serviceSupabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          digest_frequency: frequency,
          ...(hasPush ? { push_enabled } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (error) {
      console.error("Failed to update preferences:", error)
      return errorResponse("Failed to save preferences")
    }

    return NextResponse.json({ digest_frequency: frequency, ...(hasPush ? { push_enabled } : {}) })
  } catch (error) {
    console.error("Notification preferences PUT error:", error)
    return errorResponse("Internal server error")
  }
}
