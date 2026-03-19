import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/admin"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const { userId, plan } = await request.json()

    if (!userId || !["free", "pro"].includes(plan)) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 })
    }

    const serviceSupabase = await createServiceClient()

    await serviceSupabase.from("subscriptions").upsert(
      {
        user_id: userId,
        plan,
        status: "active",
      },
      { onConflict: "user_id" }
    )

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    console.error("Toggle plan error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
