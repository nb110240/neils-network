import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { safeCompare } from "@/lib/api-utils"
import { log } from "@/lib/logger"
import { getUserPlan } from "@/lib/subscription"
import { fetchAllRows } from "@/lib/fetch-all"
import { buildPipelineDigest, loadPipelineData, sendPipelineDigestEmail } from "@/lib/pipeline-digest"
import { EmailSendError } from "@/lib/email"

// Monday morning: each founder's co-founder or advisor gets the state of
// the raise (see src/lib/pipeline-digest.ts for what is and isn't shared).

export const maxDuration = 300

const ROUTE = "/api/cron/pipeline-digest"
const CONCURRENCY = 5
/** A retried or doubled cron run must not email anyone twice in a week. */
const RESEND_GUARD_MS = 6 * 24 * 60 * 60 * 1000
/** Space sends ~5/s, under Resend's default 10 requests/second. */
const MIN_SEND_GAP_MS = 200
/** Backoff before each retry of a send Resend rate-limited. */
const RATE_LIMIT_BACKOFF_MS = [1_000, 2_000, 4_000]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** One shared slot clock: concurrent users still send one at a time, spaced. */
function createPacer(gapMs: number) {
  let nextSlot = 0
  return async () => {
    const now = Date.now()
    const at = Math.max(now, nextSlot)
    nextSlot = at + gapMs
    if (at > now) await sleep(at - now)
  }
}

function isRateLimited(error: unknown): boolean {
  return error instanceof EmailSendError && error.code === "rate_limit_exceeded"
}

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
    const pace = createPacer(MIN_SEND_GAP_MS)
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
            // Claim the week's send before sending, as a compare-and-swap on
            // the last_sent_at we listed: a recipient another run already
            // emailed, or who just unsubscribed, is skipped, and a failed
            // record can never cause a second email.
            const claimedAt = new Date().toISOString()
            const claim = service
              .from("pipeline_digest_recipients")
              .update({ last_sent_at: claimedAt })
              .eq("id", recipient.id)
              .is("unsubscribed_at", null)
            const { data: claimed, error: claimError } = await (recipient.last_sent_at
              ? claim.eq("last_sent_at", recipient.last_sent_at)
              : claim.is("last_sent_at", null)
            ).select("id")
            if (claimError) {
              failed++
              log("warn", "pipeline digest claim failed", { action: "cron.pipeline_digest", route: ROUTE, userId, error: claimError.message })
              continue
            }
            if (!claimed || claimed.length === 0) {
              skipped++
              continue
            }
            try {
              for (let attempt = 0; ; attempt++) {
                await pace()
                try {
                  await sendPipelineDigestEmail({
                    to: recipient.email,
                    unsubscribeToken: recipient.unsubscribe_token,
                    digest,
                    founderEmail: user.email,
                  })
                  break
                } catch (err) {
                  if (!isRateLimited(err) || attempt >= RATE_LIMIT_BACKOFF_MS.length) throw err
                  await sleep(RATE_LIMIT_BACKOFF_MS[attempt])
                }
              }
              sent++
            } catch (err) {
              failed++
              log("warn", "pipeline digest send failed", { action: "cron.pipeline_digest", route: ROUTE, userId, error: String(err) })
              // Release the claim so next week's run (or a re-run) retries.
              // If this fails too, they miss one week: never a duplicate.
              const { error: releaseError } = await service
                .from("pipeline_digest_recipients")
                .update({ last_sent_at: recipient.last_sent_at })
                .eq("id", recipient.id)
                .eq("last_sent_at", claimedAt)
              if (releaseError) {
                log("error", "pipeline digest claim release failed", { action: "cron.pipeline_digest", route: ROUTE, userId, error: releaseError.message })
              }
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
