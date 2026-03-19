import { NextResponse, type NextRequest } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/admin"
import { verifyDevSecret } from "@/lib/api-utils"

export async function GET(request: NextRequest) {
  try {
    const devError = verifyDevSecret(request)
    if (devError) return devError

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

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
