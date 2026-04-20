import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { safeCompare } from "@/lib/api-utils"
import { log } from "@/lib/logger"

const UNVERIFIED_CUTOFF_DAYS = 7
const PER_PAGE = 1000
const MAX_DELETES_PER_RUN = 500

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!cronSecret || !token || !safeCompare(token, cronSecret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const rl = await rateLimit("cron:cleanup-unverified", "cron")
  if (!rl.success) {
    return NextResponse.json(
      { message: "Cron already ran recently" },
      { status: 429, headers: rateLimitHeaders(rl) }
    )
  }

  try {
    const supabase = await createServiceClient()
    const cutoff = new Date(Date.now() - UNVERIFIED_CUTOFF_DAYS * 24 * 60 * 60 * 1000)

    const deleted: string[] = []
    const errors: Array<{ id: string; message: string }> = []
    let page = 1
    let done = false

    while (!done && deleted.length < MAX_DELETES_PER_RUN) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      })
      if (error) {
        log("error", "cleanup-unverified: listUsers failed", {
          action: "cron.cleanup_unverified",
          route: "/api/cron/cleanup-unverified",
          error: error.message,
        })
        break
      }
      const users = data?.users ?? []
      if (users.length === 0) {
        done = true
        break
      }

      for (const u of users) {
        if (deleted.length >= MAX_DELETES_PER_RUN) break
        if (u.email_confirmed_at) continue
        if (!u.created_at) continue
        if (new Date(u.created_at) >= cutoff) continue

        const { error: delError } = await supabase.auth.admin.deleteUser(u.id)
        if (delError) {
          errors.push({ id: u.id, message: delError.message })
          continue
        }
        deleted.push(u.id)
      }

      if (users.length < PER_PAGE) {
        done = true
      } else {
        page += 1
      }
    }

    log("info", "cleanup-unverified complete", {
      action: "cron.cleanup_unverified",
      route: "/api/cron/cleanup-unverified",
      deleted: deleted.length,
      errors: errors.length,
      cutoffDays: UNVERIFIED_CUTOFF_DAYS,
    })

    return NextResponse.json({
      deleted: deleted.length,
      errors: errors.length,
      cutoffDays: UNVERIFIED_CUTOFF_DAYS,
    })
  } catch (err) {
    log("error", "cleanup-unverified failed", {
      action: "cron.cleanup_unverified",
      route: "/api/cron/cleanup-unverified",
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ message: "Failed" }, { status: 500 })
  }
}
