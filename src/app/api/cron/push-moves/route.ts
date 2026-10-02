import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { safeCompare } from "@/lib/api-utils"
import { log } from "@/lib/logger"
import { isPushConfigured, sendPushToUser } from "@/lib/push/send"
import { dailyMovesMessage, type DuePromise } from "@/lib/push/messages"

const ROUTE = "/api/cron/push-moves"
const PAGE_SIZE = 1000
const CONCURRENCY = 10
const DAY_MS = 24 * 60 * 60 * 1000
/** Promises due within this window count as "today" for a morning nudge. */
const DUE_WINDOW_MS = DAY_MS
/** Older overdue promises stop buzzing: a daily reminder becomes noise. */
const OVERDUE_LOOKBACK_MS = 14 * DAY_MS

type Service = Awaited<ReturnType<typeof createServiceClient>>

/** Every user with at least one registered device, paged past the API row cap. */
async function usersWithDevices(service: Service): Promise<string[]> {
  const ids = new Set<string>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await service
      .from("push_tokens")
      .select("user_id")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    for (const row of data || []) ids.add((row as { user_id: string }).user_id)
    if (!data || data.length < PAGE_SIZE) break
  }
  return [...ids]
}

async function nudgeUser(service: Service, userId: string, now: number): Promise<boolean> {
  const [{ data: promiseRows }, { count: pendingReviews }, { data: introRows }] = await Promise.all([
    service
      .from("commitments")
      .select("title, contact_id, due_at")
      .eq("user_id", userId)
      .eq("status", "open")
      .eq("direction", "user_owes")
      .gte("due_at", new Date(now - OVERDUE_LOOKBACK_MS).toISOString())
      .lte("due_at", new Date(now + DUE_WINDOW_MS).toISOString())
      .order("due_at", { ascending: true })
      .limit(20),
    service
      .from("after_call_reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending"),
    service
      .from("intro_requests")
      .select("target_contact_id")
      .eq("user_id", userId)
      .in("status", ["requested", "accepted", "introduced"])
      .lte("next_follow_up_at", new Date(now).toISOString())
      .limit(5),
  ])

  // Names for the contacts involved, skipping archived ones entirely.
  const contactIds = [
    ...new Set([
      ...(promiseRows || []).map((r: { contact_id: string }) => r.contact_id),
      ...(introRows || []).map((r: { target_contact_id: string }) => r.target_contact_id),
    ]),
  ]
  const names = new Map<string, string>()
  if (contactIds.length > 0) {
    const { data: contacts } = await service
      .from("contacts")
      .select("id, name")
      .eq("created_by", userId)
      .in("id", contactIds)
      .is("archived_at", null)
    for (const c of contacts || []) {
      const row = c as { id: string; name: string | null }
      if (row.name) names.set(row.id, row.name)
    }
  }

  const promises: DuePromise[] = (promiseRows || []).flatMap((row: { title: string; contact_id: string; due_at: string }) => {
    const contactName = names.get(row.contact_id)
    return contactName ? [{ title: row.title, contactId: row.contact_id, contactName, dueAt: row.due_at }] : []
  })
  const introFollowUps = (introRows || []).flatMap((row: { target_contact_id: string }) => {
    const targetName = names.get(row.target_contact_id)
    return targetName ? [{ targetName }] : []
  })

  const message = dailyMovesMessage({ promises, pendingReviews: pendingReviews || 0, introFollowUps })
  if (!message) return false
  const result = await sendPushToUser(service, userId, message)
  return result.sent > 0
}

/**
 * Morning push for people with the app installed: the promise that's due,
 * notes waiting for review, or an intro follow-up. One notification per
 * user, nothing when there's nothing to do.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!cronSecret || !token || !safeCompare(token, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = await rateLimit("cron:push-moves", "cron")
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(rl) })
  }

  if (!isPushConfigured()) return NextResponse.json({ skipped: "not_configured", sent: 0 })

  try {
    const service = await createServiceClient()
    const userIds = await usersWithDevices(service)
    const now = Date.now()
    let sent = 0
    let failed = 0
    for (let i = 0; i < userIds.length; i += CONCURRENCY) {
      const results = await Promise.allSettled(userIds.slice(i, i + CONCURRENCY).map((id) => nudgeUser(service, id, now)))
      for (const r of results) {
        if (r.status === "fulfilled") {
          if (r.value) sent++
        } else {
          failed++
          log("error", "Push nudge failed for a user", { action: "cron.push_moves", route: ROUTE, error: String(r.reason) })
        }
      }
    }
    log("info", "Push nudges sent", { action: "cron.push_moves", route: ROUTE, users: userIds.length, sent, failed })
    return NextResponse.json({ users: userIds.length, sent, failed })
  } catch (error) {
    log("error", "Push nudge cron failed", { action: "cron.push_moves", route: ROUTE, error: String(error) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
