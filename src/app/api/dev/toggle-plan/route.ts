import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { verifyDevAccess } from "@/lib/api-utils"

export async function POST(request: Request) {
  try {
    const devError = await verifyDevAccess(request)
    if (devError) return devError

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
