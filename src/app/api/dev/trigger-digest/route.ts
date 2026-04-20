import { NextResponse, type NextRequest } from "next/server"
import { verifyDevAccess } from "@/lib/api-utils"

export async function POST(request: NextRequest) {
  try {
    const devError = await verifyDevAccess(request)
    if (devError) return devError

    // Derive the base URL from the incoming request instead of reading an
    // env var with a production fallback. The old `|| "https://savvo.app"`
    // would silently forward a dev-triggered digest to production if
    // NEXT_PUBLIC_APP_URL was unset — which, given dev routes share the
    // same CRON_SECRET in some environments, would send real digest
    // emails from a dev flow. Same-origin is always correct here.
    const origin = new URL(request.url).origin
    const res = await fetch(`${origin}/api/cron/daily-digest`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Trigger digest error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
