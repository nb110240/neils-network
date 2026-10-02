import { NextResponse } from "next/server"
import { z } from "zod/v4"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
  forbiddenResponse,
  isValidUUID,
  notFoundResponse,
} from "@/lib/api-utils"
import { createServiceClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import { createShareToken } from "@/lib/share-token"
import { MAX_PIPELINE_RECIPIENTS } from "@/lib/pipeline-digest"
import { log } from "@/lib/logger"

const ROUTE = "/api/settings/pipeline-digest"
const RecipientSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(320)) })
const COLUMNS = "id, email, created_at, last_sent_at, unsubscribed_at"

type Service = Awaited<ReturnType<typeof createServiceClient>>

async function listRecipients(service: Service, userId: string) {
  const { data, error } = await service
    .from("pipeline_digest_recipients")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user } = auth
    const service = await createServiceClient()
    const [plan, recipients] = await Promise.all([getUserPlan(user.id), listRecipients(service, user.id)])
    return NextResponse.json({ recipients, can_use: plan !== "free", max: MAX_PIPELINE_RECIPIENTS })
  } catch (error) {
    log("error", "pipeline digest settings GET failed", { action: "pipeline_digest.list", route: ROUTE, error: String(error) })
    return errorResponse("Could not load your pipeline email settings")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user } = auth
    if ((await getUserPlan(user.id)) === "free") return forbiddenResponse("The weekly pipeline email is a Pro feature")

    const parsed = RecipientSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return badRequestResponse("Enter a valid email address")
    const { email } = parsed.data

    const service = await createServiceClient()
    const existing = await listRecipients(service, user.id)
    const match = existing.find((r) => r.email === email)
    if (match?.unsubscribed_at) {
      return NextResponse.json({ error: `${email} stopped these emails, so they can't be added again.` }, { status: 409 })
    }
    if (match) return NextResponse.json({ error: `${email} already gets your pipeline email.` }, { status: 409 })
    if (existing.filter((r) => !r.unsubscribed_at).length >= MAX_PIPELINE_RECIPIENTS) {
      return badRequestResponse(`You can share your pipeline with up to ${MAX_PIPELINE_RECIPIENTS} people.`)
    }

    const { data, error } = await service
      .from("pipeline_digest_recipients")
      .insert({ user_id: user.id, email, unsubscribe_token: createShareToken() })
      .select(COLUMNS)
      .single()
    if (error) {
      // Two tabs adding the same address at once.
      if (error.code === "23505") return NextResponse.json({ error: `${email} already gets your pipeline email.` }, { status: 409 })
      throw new Error(error.message)
    }
    log("info", "pipeline digest recipient added", { action: "pipeline_digest.add", route: ROUTE, userId: user.id })
    return NextResponse.json({ recipient: data }, { status: 201 })
  } catch (error) {
    log("error", "pipeline digest settings POST failed", { action: "pipeline_digest.add", route: ROUTE, error: String(error) })
    return errorResponse("Could not add that person")
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user } = auth
    const id = new URL(request.url).searchParams.get("id") || ""
    if (!isValidUUID(id)) return badRequestResponse("Choose someone to remove")

    const service = await createServiceClient()
    // Owner-scoped, and unsubscribed rows stay: they block re-adding.
    const { data, error } = await service
      .from("pipeline_digest_recipients")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .is("unsubscribed_at", null)
      .select("id")
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return notFoundResponse("Recipient not found")
    return NextResponse.json({ success: true })
  } catch (error) {
    log("error", "pipeline digest settings DELETE failed", { action: "pipeline_digest.remove", route: ROUTE, error: String(error) })
    return errorResponse("Could not remove that person")
  }
}
