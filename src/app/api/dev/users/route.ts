import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { verifyDevAccess } from "@/lib/api-utils"

export async function GET(request: NextRequest) {
  try {
    const devError = await verifyDevAccess(request)
    if (devError) return devError

    const serviceSupabase = await createServiceClient()

    // Get all users from auth
    const { data: { users } } = await serviceSupabase.auth.admin.listUsers()

    // Get all subscriptions
    const { data: subs } = await serviceSupabase
      .from("subscriptions")
      .select("user_id, plan, status")

    const subMap = new Map((subs || []).map((s) => [s.user_id, s]))

    const result = (users || []).map((u) => {
      const sub = subMap.get(u.id)
      return {
        id: u.id,
        email: u.email || "",
        plan: sub?.status === "active" ? sub.plan : "free",
      }
    })

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error("Dev users error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
