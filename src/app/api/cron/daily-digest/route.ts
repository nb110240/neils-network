import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { calculateHealthScore } from "@/lib/health"
import { sendDigestEmail, sendNewUserNudgeEmail } from "@/lib/email"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { safeCompare } from "@/lib/api-utils"
import { log } from "@/lib/logger"

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

    // Get all users with active subscriptions (Pro users)
    const { data: proUsers } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("plan", "pro")
      .eq("status", "active")

    const proUserIds = new Set((proUsers || []).map((u) => u.user_id))

    // Get ALL users who have contacts (free users get weekly digest)
    const { data: allUserRows } = await supabase
      .from("contacts")
      .select("created_by")
      .is("archived_at", null)

    // Deduplicate user IDs
    const allUserIds = [...new Set((allUserRows || []).map((r) => r.created_by))]

    if (allUserIds.length === 0) {
      return NextResponse.json({ message: "No users with contacts", sent: 0 })
    }

    let emailsSent = 0
    let nudgesSent = 0
    let skipped = 0
    const day = new Date().getDay()
    const isMonday = day === 1
    // New users get a Mon/Wed/Fri nudge — more touchpoints during the habit window
    const isNudgeDay = day === 1 || day === 3 || day === 5

    for (const user_id of allUserIds) {
      const isPro = proUserIds.has(user_id)

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
        skipped++
        continue
      }

      // Get user email
      const { data: { user } } = await supabase.auth.admin.getUserById(user_id)
      if (!user?.email) continue

      const userName =
        user.user_metadata?.full_name || user.email.split("@")[0]

      // Get user's contacts with scheduling fields for richer context
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, company, job_title, how_we_met, next_steps, last_contact_date, created_at, follow_up_needed, cadence_days, snoozed_until, next_due_date")
        .eq("created_by", user_id)
        .is("archived_at", null)

      if (!contacts || contacts.length === 0) continue

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
        if (isNewAccount ? !isNudgeDay : !isMonday) continue

        await sendNewUserNudgeEmail(user.email, userName, contacts)
        nudgesSent++
        continue
      }

      // Full digest path (5+ contacts) — apply frequency-based cadence

      // Weekly users only get emails on Mondays
      if (frequency === "weekly" && !isMonday) {
        continue
      }

      // Free users can only have weekly frequency — downgrade to weekly silently
      if (!isPro && frequency === "daily" && !isMonday) {
        continue
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

      if (eligible.length === 0) continue

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

      if (picks.length === 0) continue

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
      await sendDigestEmail(user.email, userName, picks, {
        totalContacts: contacts.length,
        healthBreakdown,
        followUpCount,
        isPro,
        isWeekly: frequency === "weekly",
      })

      // Record in digest_history
      for (const contact of picks) {
        await supabase.from("digest_history").insert({
          user_id,
          contact_id: contact.id,
        })
      }

      emailsSent++
    }

    log("info", "Daily digest completed", {
      action: "cron.daily_digest",
      route: "/api/cron/daily-digest",
      userCount: allUserIds.length,
      proUsers: proUserIds.size,
      freeUsers: allUserIds.length - proUserIds.size,
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
