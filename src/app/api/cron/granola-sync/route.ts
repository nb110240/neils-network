import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { safeCompare } from "@/lib/api-utils"
import { log } from "@/lib/logger"
import { getUserPlan } from "@/lib/subscription"
import { syncGranolaForUser } from "@/lib/granola-sync"
import { sendPushToUser } from "@/lib/push/send"
import { calendarReviewsMessage } from "@/lib/push/messages"

// Nightly Granola import: yesterday's meetings are waiting in the Review
// Inbox by morning, without anyone pressing "Sync now".

export const maxDuration = 300

const ROUTE = "/api/cron/granola-sync"
/** Integrations considered per run; least recently attempted go first. */
const MAX_USERS_PER_RUN = 50
const CONCURRENCY = 5
/** Stop starting new users after this, leaving room for in-flight syncs. */
const TIME_BUDGET_MS = 200_000

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!cronSecret || !token || !safeCompare(token, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = await rateLimit("cron:granola-sync", "cron")
  if (!rl.success) {
    return NextResponse.json({ message: "Cron already ran recently" }, { status: 429, headers: rateLimitHeaders(rl) })
  }

  const started = Date.now()
  try {
    const service = await createServiceClient()
    const { data: integrations, error } = await service
      .from("integrations")
      .select("id, user_id, access_token, last_sync_at")
      .eq("provider", "granola")
      .order("last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(MAX_USERS_PER_RUN)
    if (error) throw new Error(error.message)

    let synced = 0
    let imported = 0
    let failed = 0
    let deferred = 0
    for (let index = 0; index < (integrations || []).length; index += CONCURRENCY) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        deferred = (integrations || []).length - index
        break
      }
      const batch = (integrations || []).slice(index, index + CONCURRENCY)
      const results = await Promise.all(batch.map(async (integration) => {
        const { id, user_id } = integration
        await service.from("integrations").update({ last_attempt_at: new Date().toISOString() }).eq("id", id)
        try {
          if (!integration.access_token) return null
          if ((await getUserPlan(user_id)) === "free") {
            await service.from("integrations").update({ last_sync_error: "Plan does not include Granola sync" }).eq("id", id)
            return null
          }
          const { data: { user } } = await service.auth.admin.getUserById(user_id)
          if (!user) return null
          const result = await syncGranolaForUser(service, user, integration)
          await service.from("integrations").update({ last_sync_error: null }).eq("id", id)
          // New notes are waiting for review: nudge the phone. "Sync now"
          // skips this; the person is already in the app.
          const message = calendarReviewsMessage(result.imported)
          if (message) await sendPushToUser(service, user_id, message)
          return result
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          log("warn", "Granola nightly sync failed for user", { action: "cron.granola_sync", route: ROUTE, userId: user_id, error: message })
          await service.from("integrations").update({ last_sync_error: message.slice(0, 500) }).eq("id", id)
          return "failed" as const
        }
      }))
      for (const result of results) {
        if (result === "failed") failed++
        else if (result) {
          synced++
          imported += result.imported
        }
      }
    }

    if (imported > 0) {
      revalidatePath("/dashboard")
      revalidatePath("/inbox")
    }
    log("info", "Granola nightly sync", { action: "cron.granola_sync", route: ROUTE, synced, imported, failed, deferred })
    return NextResponse.json({ success: true, synced, imported, failed, deferred })
  } catch (error) {
    log("error", "Granola nightly sync crashed", {
      action: "cron.granola_sync",
      route: ROUTE,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
