import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { isValidShareToken } from "@/lib/share-token"
import { log } from "@/lib/logger"

// Stops a founder's weekly pipeline email for one recipient. Two callers:
// - mail clients' one-click unsubscribe (RFC 8058): POST ?token=… with a
//   List-Unsubscribe=One-Click body, answered with 200;
// - the confirm form on /pipeline/unsubscribe/[token]: answered with a
//   redirect back to that page.
// GET does nothing on purpose: link scanners prefetch URLs in emails.

const ROUTE = "/api/pipeline-digest/unsubscribe"

async function tokenFrom(request: Request): Promise<string | null> {
  const fromQuery = new URL(request.url).searchParams.get("token")
  if (fromQuery) return fromQuery
  const type = request.headers.get("content-type") || ""
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null)
    const value = form?.get("token")
    return typeof value === "string" ? value : null
  }
  return null
}

export async function POST(request: Request) {
  const token = await tokenFrom(request)
  if (!isValidShareToken(token)) return NextResponse.json({ error: "Invalid link" }, { status: 400 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from("pipeline_digest_recipients")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null)
    .select("id, user_id")
  if (error) {
    log("error", "pipeline digest unsubscribe failed", { action: "pipeline_digest.unsubscribe", route: ROUTE, error: error.message })
    return NextResponse.json({ error: "Could not unsubscribe. Please try again." }, { status: 500 })
  }
  if (data && data.length > 0) {
    log("info", "pipeline digest recipient unsubscribed", { action: "pipeline_digest.unsubscribe", route: ROUTE, userId: data[0].user_id })
  }

  // Already unsubscribed (or an unknown token) still reads as done: the
  // outcome the person wants is true either way.
  const fromForm = new URL(request.url).searchParams.get("token") === null
  if (fromForm) {
    return NextResponse.redirect(new URL(`/pipeline/unsubscribe/${token}?done=1`, request.url), 303)
  }
  return NextResponse.json({ success: true })
}
