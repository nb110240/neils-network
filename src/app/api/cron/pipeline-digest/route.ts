import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { safeCompare } from "@/lib/api-utils"
import { log } from "@/lib/logger"
import { getUserPlan } from "@/lib/subscription"
import { fetchAllRows } from "@/lib/fetch-all"
import { buildPipelineDigest, loadPipelineData, sendPipelineDigestEmail } from "@/lib/pipeline-digest"

// Monday morning: each founder's co-founder or advisor gets the state of
// the raise (see src/lib/pipeline-digest.ts for what is and isn't shared).

export const maxDuration = 300

const ROUTE = "/api/cron/pipeline-digest"
const CONCURRENCY = 5
/** A retried or doubled cron run must not email anyone twice in a week. */
const RESEND_GUARD_MS = 6 * 24 * 60 * 60 * 1000

type Recipient = { id: string; user_id: string; email: string; unsubscribe_token: string; last_sent_at: string | null }

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!cronSecret || !token || !safeCompare(token, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = await rateLimit("cron:pipeline-digest", "cron")
  if (!rl.success) {
    return NextResponse.json({ message: "Cron already ran recently" }, { status: 429, headers: rateLimitHeaders(rl) })
  }

  try {
    const service = await createServiceClient()
    const now = new Date()
    const { data: recipients, error } = await fetchAllRows<Recipient>((from, to) =>
      service
        .from("pipeline_digest_recipients")
        .select("id, user_id, email, unsubscribe_token, last_sent_at")
        .is("unsubscribed_at", null)
        .order("id", { ascending: true })
        .range(from, to)
    )
    if (error) throw new Error(error.message)

    const byUser = new Map<string, Recipient[]>()
    for (const r of recipients) {
      if (r.last_sent_at && now.getTime() - new Date(r.last_sent_at).getTime() < RESEND_GUARD_MS) continue
      byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r])
    }

    let sent = 0
    let failed = 0
    let skipped = 0
    const users = [...byUser.entries()]
    for (let index = 0; index < users.length; index += CONCURRENCY) {
      await Promise.all(users.slice(index, index + CONCURRENCY).map(async ([userId, list]) => {
        try {
          if ((await getUserPlan(userId)) === "free") {
            skipped += list.length
            return
          }
          const { data: { user } } = await service.auth.admin.getUserById(userId)
          if (!user?.email) {
            skipped += list.length
            return
          }
          const founderName = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email.split("@")[0]
          const data = await loadPipelineData(service, userId, now)
          const digest = buildPipelineDigest({ founderName, ...data })
          // No investors tracked yet: nothing worth an email.
          if (!digest) {
            skipped += list.length
            return
          }
          for (const recipient of list) {
            try {
              await sendPipelineDigestEmail({
                to: recipient.email,
                unsubscribeToken: recipient.unsubscribe_token,
                digest,
                founderEmail: user.email,
              })
              await service
                .from("pipeline_digest_recipients")
                .update({ last_sent_at: new Date().toISOString() })
                .eq("id", recipient.id)
              sent++
            } catch (err) {
              failed++
              log("warn", "pipeline digest send failed", { action: "cron.pipeline_digest", route: ROUTE, userId, error: String(err) })
            }
          }
        } catch (err) {
          failed += list.length
          log("warn", "pipeline digest failed for user", { action: "cron.pipeline_digest", route: ROUTE, userId, error: String(err) })
        }
      }))
    }

    log("info", "Pipeline digests sent", { action: "cron.pipeline_digest", route: ROUTE, sent, failed, skipped })
    return NextResponse.json({ success: true, sent, failed, skipped })
  } catch (error) {
    log("error", "Pipeline digest cron crashed", {
      action: "cron.pipeline_digest",
      route: ROUTE,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
