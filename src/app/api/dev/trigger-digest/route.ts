import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/admin"
import { verifyDevSecret } from "@/lib/api-utils"

export async function POST(request: NextRequest) {
  try {
    const devError = verifyDevSecret(request)
    if (devError) return devError

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    // Call the digest endpoint with the cron secret
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/cron/daily-digest`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Trigger digest error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
