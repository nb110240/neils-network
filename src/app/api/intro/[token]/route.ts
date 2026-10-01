import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { badRequestResponse, errorResponse, notFoundResponse } from "@/lib/api-utils"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { createServiceClient } from "@/lib/supabase/server"
import { isValidShareToken } from "@/lib/share-token"
import { sendIntroResponseEmail } from "@/lib/email"
import { log } from "@/lib/logger"

const ResponseSchema = z.object({
  accept: z.boolean(),
  note: z.string().max(1000).nullable().optional(),
}).strict()

interface IntroSummary {
  connector_name: string | null
  target_name: string | null
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"
}

// Public: the connector (no Savvo account) accepts or declines. The token
// is the only credential, so every lookup goes through service-role RPCs
// that return or change just this one request.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    if (!isValidShareToken(token)) return notFoundResponse("This link is not valid")

    const rl = await rateLimit(`intro-respond:${clientIp(request)}`, "auth")
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Try again in a minute." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const parsed = ResponseSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return badRequestResponse("Choose yes or no")
    const { accept, note } = parsed.data

    const service = await createServiceClient()
    const { data: summary } = await service.rpc("intro_request_for_token", { p_token: token })
    if (!summary) return notFoundResponse("This link is not valid")

    const { data: result, error } = await service.rpc("respond_to_intro_request", {
      p_token: token,
      p_accept: accept,
      p_note: note ?? null,
    })
    if (error || !result) return errorResponse("Could not record your answer")

    const outcome = (result as { outcome: string }).outcome
    if (outcome === "not_found") return notFoundResponse("This link is not valid")
    if (outcome === "already_responded") {
      return NextResponse.json({ error: "This request already has an answer" }, { status: 409 })
    }

    revalidatePath("/intros")
    revalidatePath("/dashboard")
    revalidatePath("/moves")

    // Best effort: the answer is saved either way.
    const ownerId = (result as { user_id?: string }).user_id
    if (ownerId && process.env.RESEND_API_KEY) {
      try {
        const { data: owner } = await service.auth.admin.getUserById(ownerId)
        if (owner?.user?.email) {
          const info = summary as IntroSummary
          await sendIntroResponseEmail(owner.user.email, {
            accepted: accept,
            connectorName: info.connector_name,
            targetName: info.target_name,
            note: note?.trim() || null,
          })
        }
      } catch (emailError) {
        log("error", "Intro response email failed", {
          action: "intro.respond_email",
          route: "/api/intro/[token]",
          error: String(emailError),
        })
      }
    }

    return NextResponse.json({ outcome })
  } catch (error) {
    console.error("Intro respond error:", error)
    return errorResponse("Could not record your answer")
  }
}
