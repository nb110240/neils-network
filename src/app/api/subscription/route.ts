import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { getUserPlan } from "@/lib/subscription"

export async function GET() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const plan = await getUserPlan(user.id)

    return NextResponse.json({ plan })
  } catch (error) {
    console.error("Error fetching subscription:", error)
    return errorResponse("Internal server error")
  }
}
