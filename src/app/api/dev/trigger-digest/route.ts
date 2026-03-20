import { NextResponse, type NextRequest } from "next/server"
import { verifyDevAccess } from "@/lib/api-utils"

export async function POST(request: NextRequest) {
  try {
    const devError = await verifyDevAccess(request)
    if (devError) return devError

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
