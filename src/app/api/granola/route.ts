import { NextResponse } from "next/server"
import { z } from "zod/v4"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
  forbiddenResponse,
} from "@/lib/api-utils"
import { createServiceClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import { listGranolaNotes } from "@/lib/granola"

const ConnectSchema = z.object({
  api_key: z.string().trim().min(10).max(500),
}).strict()

async function ensurePaid(userId: string) {
  return (await getUserPlan(userId)) !== "free"
}

export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user } = auth
    const canConnect = await ensurePaid(user.id)
    if (!canConnect) return NextResponse.json({ connected: false, can_connect: false })

    const service = await createServiceClient()
    const { data, error } = await service
      .from("integrations")
      .select("id, last_sync_at")
      .eq("user_id", user.id)
      .eq("provider", "granola")
      .maybeSingle()

    if (error) return errorResponse("Could not load Granola status")
    return NextResponse.json({
      connected: Boolean(data),
      can_connect: true,
      last_sync_at: data?.last_sync_at || null,
    })
  } catch (error) {
    console.error("Granola status error:", error)
    return errorResponse("Could not load Granola status")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("import")
    if (authFailed(auth)) return auth.error
    const { user } = auth
    if (!(await ensurePaid(user.id))) return forbiddenResponse("Granola sync is a Pro feature")

    const parsed = ConnectSchema.safeParse(await request.json())
    if (!parsed.success) return badRequestResponse("Enter a valid Granola API key")

    try {
      await listGranolaNotes(parsed.data.api_key, undefined, 1)
    } catch (error) {
      return badRequestResponse(error instanceof Error ? error.message : "Granola rejected this API key")
    }

    const service = await createServiceClient()
    const { error } = await service.from("integrations").upsert(
      {
        user_id: user.id,
        provider: "granola",
        access_token: parsed.data.api_key,
        refresh_token: null,
        token_expires_at: null,
        last_sync_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    )
    if (error) return errorResponse("Could not save the Granola connection")

    return NextResponse.json({ connected: true, can_connect: true, last_sync_at: null })
  } catch (error) {
    console.error("Granola connection error:", error)
    return errorResponse("Could not connect Granola")
  }
}

export async function DELETE() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user } = auth
    const service = await createServiceClient()
    const { error } = await service
      .from("integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "granola")

    if (error) return errorResponse("Could not disconnect Granola")
    return NextResponse.json({ connected: false, can_connect: true, last_sync_at: null })
  } catch (error) {
    console.error("Granola disconnect error:", error)
    return errorResponse("Could not disconnect Granola")
  }
}
