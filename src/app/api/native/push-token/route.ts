import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { createServiceClient } from "@/lib/supabase/server"
import { log } from "@/lib/logger"

const ROUTE = "/api/native/push-token"

// APNs tokens are hex; FCM registration tokens use [A-Za-z0-9_:-].
const TokenSchema = z.string().trim().min(16).max(4096).regex(/^[A-Za-z0-9_:.-]+$/, "Invalid token")

const RegisterSchema = z.object({ token: TokenSchema, platform: z.enum(["ios", "android"]) }).strict()
const ForgetSchema = z.object({ token: TokenSchema }).strict()

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Registers this device for the signed-in user (re-assigning it if it belonged to someone else). */
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const parsed = RegisterSchema.safeParse(await readJson(request))
    if (!parsed.success) return badRequestResponse("Invalid push registration")

    const service = await createServiceClient()
    const { error } = await service.from("push_tokens").upsert(
      {
        token: parsed.data.token,
        platform: parsed.data.platform,
        user_id: user.id,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    )
    if (error) {
      log("error", "Failed to save push token", { action: "push.register", route: ROUTE, userId: user.id, error: error.message })
      return errorResponse("Could not register for notifications")
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    log("error", "Push token registration error", { action: "push.register", route: ROUTE, error: String(error) })
    return errorResponse("Could not register for notifications")
  }
}

/**
 * Forgets a device on sign-out. The session is already gone by then, so
 * this is keyed by the token itself, which only the device and our server
 * know. Rate limited by IP.
 */
export async function DELETE(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
    const rl = await rateLimit(`push-forget:${ip}`, "auth")
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(rl) })
    }

    const parsed = ForgetSchema.safeParse(await readJson(request))
    if (!parsed.success) return badRequestResponse("Invalid token")

    const service = await createServiceClient()
    const { error } = await service.from("push_tokens").delete().eq("token", parsed.data.token)
    if (error) {
      log("error", "Failed to forget push token", { action: "push.forget", route: ROUTE, error: error.message })
      return errorResponse("Could not unregister this device")
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    log("error", "Push token forget error", { action: "push.forget", route: ROUTE, error: String(error) })
    return errorResponse("Could not unregister this device")
  }
}
