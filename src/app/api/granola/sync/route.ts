import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  authenticateRequest,
  authFailed,
  errorResponse,
  forbiddenResponse,
} from "@/lib/api-utils"
import { syncGranolaForUser } from "@/lib/granola-sync"
import { createServiceClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"

export async function POST() {
  try {
    const auth = await authenticateRequest("import")
    if (authFailed(auth)) return auth.error
    const { user } = auth
    if ((await getUserPlan(user.id)) === "free") return forbiddenResponse("Granola sync is a Pro feature")

    const service = await createServiceClient()
    const { data: integration } = await service
      .from("integrations")
      .select("id, access_token, last_sync_at")
      .eq("user_id", user.id)
      .eq("provider", "granola")
      .maybeSingle()

    if (!integration?.access_token) {
      return NextResponse.json({ error: "Connect Granola in Settings first" }, { status: 409 })
    }

    const { imported, skipped, failed, hasMore } = await syncGranolaForUser(service, user, integration)

    revalidatePath("/dashboard")
    revalidatePath("/inbox")
    return NextResponse.json({ imported, skipped, failed, has_more: hasMore })
  } catch (error) {
    console.error("Granola sync error:", error)
    return errorResponse(error instanceof Error ? error.message : "Could not sync Granola")
  }
}
