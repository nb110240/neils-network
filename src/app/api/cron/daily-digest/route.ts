import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { createServiceClient } from "@/lib/supabase/server"
import { calculateHealthScore } from "@/lib/health"
import { sendActivationEmail, sendDigestEmail, sendNewUserNudgeEmail } from "@/lib/email"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { safeCompare } from "@/lib/api-utils"
import { log } from "@/lib/logger"
import { DAILY_DIGEST_PLANS } from "@/lib/types"
import { buildDigestMoves, hasDigestMoves, PROMISE_WINDOW_DAYS } from "@/lib/digest-moves"
import { activationStep } from "@/lib/activation"
import { fetchAllRows } from "@/lib/fetch-all"

const DIGEST_CONCURRENCY = 10
const USERS_PER_PAGE = 1000

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>
type DigestUser = User

async function listAllUsers(supabase: ServiceClient): Promise<DigestUser[]> {
  const all: DigestUser[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE })
    if (error) throw error
    all.push(...data.users)
    if (data.users.length < USERS_PER_PAGE) return all
  }
}

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access (timing-safe)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!cronSecret || !token || !safeCompare(token, cronSecret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  // Rate limit: 2 cron executions per hour
  const rl = await rateLimit("cron:daily-digest", "cron")
  if (!rl.success) {
    return NextResponse.json(
      { message: "Cron already ran recently" },
      { status: 429, headers: rateLimitHeaders(rl) }
    )
  }

  try {
    const supabase = await createServiceClient()

    // Get all users whose active plan includes daily digests.
    const { data: dailyDigestUsers } = await supabase
      .from("subscriptions")
      .select("user_id")
      .in("plan", [...DAILY_DIGEST_PLANS])
      .eq("status", "active")

    // Referral Pro credit also unlocks daily digests (getUserPlan treats it as Pro).
    const { data: creditUsers } = await supabase
      .from("pro_credits")
      .select("user_id")
      .gt("pro_until", new Date().toISOString())

    const dailyDigestUserIds = new Set([
      ...(dailyDigestUsers || []).map((u) => u.user_id),
      ...(creditUsers || []).map((u) => u.user_id),
    ])

    // Enumerate users from auth (paginated) rather than from a contacts
    // select: PostgREST caps unpaginated selects at 1,000 rows, so once the
    // contacts table outgrew that, users outside the window silently stopped
    // getting digests. Users with no contacts are skipped below.
    const users = await listAllUsers(supabase)

    if (users.length === 0) {
      return NextResponse.json({ message: "No users", sent: 0 })
    }

    let emailsSent = 0
    let nudgesSent = 0
    let skipped = 0
    const day = new Date().getDay()
    const isMonday = day === 1
    // New users get a Mon/Wed/Fri nudge — more touchpoints during the habit window
    const isNudgeDay = day === 1 || day === 3 || day === 5

    const processUser = async (user: DigestUser): Promise<"sent" | "nudged" | "skipped" | "none"> => {
      const user_id = user.id
      const canUseDaily = dailyDigestUserIds.has(user_id)

      // Check notification preferences
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("digest_frequency")
        .eq("user_id", user_id)
        .single()

      // Default all users to weekly digest
      const frequency = prefs?.digest_frequency || "weekly"

      // Skip users who opted out entirely
      if (frequency === "never") {
        return "skipped"
      }

      if (!user.email) return "none"
      const email = user.email

      const userName =
        user.user_metadata?.full_name || email.split("@")[0]

      // Get user's contacts with scheduling fields for richer context
      // Paged: the API returns at most 1,000 rows per request.
      const { data: contacts } = await fetchAllRows((from, to) =>
        supabase
          .from("contacts")
          .select("id, name, company, job_title, how_we_met, next_steps, last_contact_date, created_at, follow_up_needed, cadence_days, snoozed_until, next_due_date")
          .eq("created_by", user_id)
          .is("archived_at", null)
          .order("id", { ascending: true })
          .range(from, to)
      )

      if (!contacts || contacts.length === 0) {
        const step = activationStep(user)
        if (!step) return "none"
        await sendActivationEmail(email, userName, step)
        // Record only after a successful send. app_metadata is server-only;
        // spread it so provider fields survive whether the API merges or
        // replaces.
        const { error: markError } = await supabase.auth.admin.updateUserById(user.id, {
          app_metadata: {
            ...user.app_metadata,
            activation_emails_sent: step,
            activation_email_last_at: new Date().toISOString(),
          },
        })
        if (markError) {
          log("error", "Failed to record activation email", {
            action: "cron.daily_digest",
            route: "/api/cron/daily-digest",
            userId: user.id,
            error: markError.message,
          })
        }
        return "nudged"
      }

      // New-user nudge path: users with 1-4 contacts can't get a useful
      // digest yet, but they still need a recurring reason to come back.
      // Without this they hear nothing from Savvo during the exact window
      // when the habit forms. New accounts (<=21 days) get a Mon/Wed/Fri
      // nudge; older accounts with a stalled network get a Monday-only one.
      if (contacts.length < 5) {
        const accountAgeDays = Math.floor(
          (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
        const isNewAccount = accountAgeDays <= 21
        if (isNewAccount ? !isNudgeDay : !isMonday) return "none"

        await sendNewUserNudgeEmail(email, userName, contacts)
        return "nudged"
      }

      // Full digest path (5+ contacts) — apply frequency-based cadence

      // Weekly users only get emails on Mondays
      if (frequency === "weekly" && !isMonday) {
        return "none"
      }

      // Free users can only have weekly frequency — downgrade to weekly silently
      if (!canUseDaily && frequency === "daily" && !isMonday) {
        return "none"
      }

      // Get recent activities for context (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentActivities } = await supabase
        .from("contact_activities")
        .select("contact_id, type, content, occurred_at")
        .eq("user_id", user_id)
        .gte("occurred_at", thirtyDaysAgo)
        .order("occurred_at", { ascending: false })

      // Map activities by contact_id for quick lookup
      const activityMap = new Map<string, { type: string; content: string; occurred_at: string }>()
      for (const a of recentActivities || []) {
        if (!activityMap.has(a.contact_id)) {
          activityMap.set(a.contact_id, a)
        }
      }

      // Get ALL digest history for this user (to count total suggestions per contact)
      const { data: allDigests } = await supabase
        .from("digest_history")
        .select("contact_id, sent_at")
        .eq("user_id", user_id)

      const recentCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const recentContactIds = new Set(
        (allDigests || [])
          .filter((d) => d.sent_at >= recentCutoff)
          .map((d) => d.contact_id)
      )

      // Count how many times each contact has been suggested (for deprioritization)
      const suggestionCount = new Map<string, number>()
      for (const d of allDigests || []) {
        suggestionCount.set(d.contact_id, (suggestionCount.get(d.contact_id) || 0) + 1)
      }

      // Filter out snoozed contacts
      const todayStr = new Date().toISOString().split("T")[0]
      const nonSnoozed = contacts.filter(
        (c) => !c.snoozed_until || c.snoozed_until < todayStr
      )

      // Score contacts with variety logic + scheduling awareness
      const eligible = nonSnoozed
        .filter((c) => !recentContactIds.has(c.id))
        .map((c) => {
          const health = calculateHealthScore(c.last_contact_date, c.created_at, c.cadence_days)
          const timesShown = suggestionCount.get(c.id) || 0
          // Deprioritize contacts shown many times — add penalty per suggestion
          const varietyPenalty = timesShown * 15
          // Boost scheduled contacts that are due today or overdue
          const scheduledBoost = c.next_due_date && c.next_due_date <= todayStr ? -50 : 0
          const adjustedScore = health.score + varietyPenalty + scheduledBoost
          const lastActivity = activityMap.get(c.id) || null
          return { ...c, health, adjustedScore, timesShown, lastActivity }
        })

      // Raise Autopilot items: promises due soon, overdue asks, pending
      // reviews and due intro follow-ups. Fetched in parallel; a failure in
      // any of them just leaves that section out.
      const nowIso = new Date().toISOString()
      const promiseHorizon = new Date(Date.now() + PROMISE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const [{ data: commitmentRows }, { count: pendingReviews }, { data: introRows }] = await Promise.all([
        supabase
          .from("commitments")
          .select("id, contact_id, direction, title, due_at")
          .eq("user_id", user_id)
          .eq("status", "open")
          .lte("due_at", promiseHorizon)
          .order("due_at", { ascending: true })
          .limit(50),
        supabase
          .from("after_call_reviews")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user_id)
          .eq("status", "pending"),
        supabase
          .from("intro_requests")
          .select("id, target_contact_id, connector_contact_id, status, next_follow_up_at")
          .eq("user_id", user_id)
          .in("status", ["requested", "accepted", "introduced"])
          .lte("next_follow_up_at", nowIso)
          .limit(20),
      ])
      const moves = buildDigestMoves({
        commitments: commitmentRows || [],
        pendingReviews: pendingReviews || 0,
        intros: introRows || [],
        contactNames: new Map(contacts.map((c) => [c.id, c.name])),
      })

      if (eligible.length === 0 && !hasDigestMoves(moves)) return "none"

      // Pick 3 contacts with a mix:
      // - 2 from lowest adjusted score (most in need of attention, varied)
      // - 1 random from "cooling" or "going cold" that hasn't been shown much
      eligible.sort((a, b) => a.adjustedScore - b.adjustedScore)

      const picks: typeof eligible = []

      // First 2: lowest adjusted score (health + variety penalty)
      for (const c of eligible) {
        if (picks.length >= 2) break
        picks.push(c)
      }

      // Third: random pick from remaining eligible that's NOT red/cold
      // This adds variety — sometimes surfacing "cooling" contacts, not just the worst
      const remainingNonCold = eligible.filter(
        (c) => !picks.some((p) => p.id === c.id) && c.health.level !== "red"
      )

      if (remainingNonCold.length > 0) {
        const randomIdx = Math.floor(Math.random() * remainingNonCold.length)
        picks.push(remainingNonCold[randomIdx])
      } else if (eligible.length > picks.length) {
        // All remaining are cold — just pick the next one
        const next = eligible.find((c) => !picks.some((p) => p.id === c.id))
        if (next) picks.push(next)
      }

      if (picks.length === 0 && !hasDigestMoves(moves)) return "none"

      // Compute network stats for the email
      const healthBreakdown = contacts.reduce(
        (acc, c) => {
          const h = calculateHealthScore(c.last_contact_date, c.created_at, c.cadence_days)
          acc[h.level] = (acc[h.level] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      const followUpCount = contacts.filter((c) => c.follow_up_needed).length

      // Send email
      await sendDigestEmail(email, userName, picks, {
        totalContacts: contacts.length,
        healthBreakdown,
        followUpCount,
        isPro: canUseDaily,
        isWeekly: frequency === "weekly",
        moves,
      })

      // Record in digest_history
      for (const contact of picks) {
        await supabase.from("digest_history").insert({
          user_id,
          contact_id: contact.id,
        })
      }

      return "sent"
    }

    // Bounded concurrency keeps the run inside the function timeout as the
    // user count grows without hammering Resend or Postgres.
    for (let i = 0; i < users.length; i += DIGEST_CONCURRENCY) {
      const batch = users.slice(i, i + DIGEST_CONCURRENCY)
      const results = await Promise.allSettled(batch.map(processUser))
      for (const [index, r] of results.entries()) {
        if (r.status === "rejected") {
          log("error", "Digest failed for user", {
            action: "cron.daily_digest",
            route: "/api/cron/daily-digest",
            userId: batch[index].id,
            error: String(r.reason),
          })
        } else if (r.value === "sent") emailsSent++
        else if (r.value === "nudged") nudgesSent++
        else if (r.value === "skipped") skipped++
      }
    }

    log("info", "Daily digest completed", {
      action: "cron.daily_digest",
      route: "/api/cron/daily-digest",
      userCount: users.length,
      paidUsers: dailyDigestUserIds.size,
      freeUsers: users.length - dailyDigestUserIds.size,
      emailsSent,
      nudgesSent,
      skipped,
    })

    return NextResponse.json({ success: true, sent: emailsSent, nudges: nudgesSent, skipped })
  } catch (error) {
    log("error", "Daily digest failed", { action: "cron.daily_digest", route: "/api/cron/daily-digest", error: String(error) })
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
