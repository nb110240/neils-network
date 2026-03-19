import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const VALID_FREQUENCIES = ["daily", "weekly", "never"] as const

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const serviceSupabase = await createServiceClient()
    const { data } = await serviceSupabase
      .from("user_preferences")
      .select("digest_frequency")
      .eq("user_id", user.id)
      .single()

    return NextResponse.json({
      digest_frequency: data?.digest_frequency || "daily",
    })
  } catch (error) {
    console.error("Notification preferences GET error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { digest_frequency } = body

    if (!digest_frequency || !VALID_FREQUENCIES.includes(digest_frequency)) {
      return NextResponse.json(
        { message: "Invalid digest_frequency. Must be: daily, weekly, or never" },
        { status: 400 }
      )
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
      return NextResponse.json({ message: "Failed to save preferences" }, { status: 500 })
    }

    return NextResponse.json({ digest_frequency })
  } catch (error) {
    console.error("Notification preferences PUT error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
