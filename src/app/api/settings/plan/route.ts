import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const plan = await getUserPlan(user.id)

    const serviceSupabase = await createServiceClient()
    const { count } = await serviceSupabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("created_by", user.id)

    return NextResponse.json({
      plan,
      contactCount: count || 0,
    })
  } catch (error) {
    console.error("Settings plan error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
