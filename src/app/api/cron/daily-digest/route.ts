import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { calculateHealthScore } from "@/lib/health"
import { sendDigestEmail } from "@/lib/email"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

    // Get all Pro users
    const { data: proUsers } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("plan", "pro")
      .eq("status", "active")

    if (!proUsers || proUsers.length === 0) {
      return NextResponse.json({ message: "No pro users", sent: 0 })
    }

    let emailsSent = 0
    let skipped = 0

    for (const { user_id } of proUsers) {
      // Check notification preferences
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("digest_frequency")
        .eq("user_id", user_id)
        .single()

      const frequency = prefs?.digest_frequency || "daily"

      // Skip users who opted out
      if (frequency === "never") {
        skipped++
        continue
      }

      // Weekly users only get emails on Mondays
      if (frequency === "weekly" && new Date().getDay() !== 1) {
        continue
      }

      // Get user email
      const { data: { user } } = await supabase.auth.admin.getUserById(user_id)
      if (!user?.email) continue

      // Get user's contacts
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, company, how_we_met, last_contact_date, created_at")
        .eq("created_by", user_id)

      if (!contacts || contacts.length === 0) continue

      // Need at least 5 contacts for digest to be useful
      if (contacts.length < 5) continue

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

      // Score contacts with variety logic
      const eligible = contacts
        .filter((c) => !recentContactIds.has(c.id))
        .map((c) => {
          const health = calculateHealthScore(c.last_contact_date, c.created_at)
          const timesShown = suggestionCount.get(c.id) || 0
          // Deprioritize contacts shown many times — add penalty per suggestion
          const varietyPenalty = timesShown * 15
          const adjustedScore = health.score + varietyPenalty
          return { ...c, health, adjustedScore, timesShown }
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

      // Send email
      const userName =
        user.user_metadata?.full_name || user.email.split("@")[0]

      await sendDigestEmail(user.email, userName, picks)

      // Record in digest_history
      for (const contact of picks) {
        await supabase.from("digest_history").insert({
          user_id,
          contact_id: contact.id,
        })
      }

      emailsSent++
    }

    return NextResponse.json({ success: true, sent: emailsSent, skipped })
  } catch (error) {
    console.error("Daily digest error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
