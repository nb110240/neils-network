import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse, forbiddenResponse } from "@/lib/api-utils"
import { getUserPlan } from "@/lib/subscription"
import { generateStructuredOutput } from "@/lib/openai"
import { log } from "@/lib/logger"
import {
  DUE_SOON_DAYS,
  INVESTOR_UPDATE_SCHEMA,
  INVESTOR_UPDATE_SYSTEM,
  InvestorUpdateInputSchema,
  buildFallbackDraft,
  buildInvestorUpdatePrompt,
  buildInvestorUpdateStats,
  cleanDraft,
  type UpdateActivityRow,
  type UpdateCommitmentRow,
  type UpdateContactRow,
  type UpdateIntroRow,
} from "@/lib/investor-update"

const DAY_MS = 24 * 60 * 60 * 1000
const ROUTE = "/api/investor-update"

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("ai")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const plan = await getUserPlan(user.id)
    if (plan === "free") {
      return forbiddenResponse("Investor updates are a Pro feature. Upgrade to unlock.")
    }

    let rawBody: unknown = {}
    const text = await request.text()
    if (text.trim()) {
      try {
        rawBody = JSON.parse(text)
      } catch {
        return badRequestResponse("Invalid JSON body")
      }
    }
    const parsed = InvestorUpdateInputSchema.safeParse(rawBody)
    if (!parsed.success) {
      return badRequestResponse(parsed.error.issues[0]?.message || "Invalid request")
    }
    const input = parsed.data

    const now = new Date()
    const since = new Date(now.getTime() - input.period_days * DAY_MS).toISOString()
    const dueSoon = new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS).toISOString()

    // Narrow selects only: no names, emails, phones, notes, or meeting content.
    const [contactsRes, activitiesRes, completedRes, openRes, introsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, investor_stage")
        .eq("created_by", user.id)
        .is("archived_at", null)
        .limit(5000),
      supabase
        .from("contact_activities")
        .select("contact_id, type, occurred_at")
        .eq("user_id", user.id)
        .eq("type", "meeting")
        .gte("occurred_at", since)
        .lte("occurred_at", now.toISOString())
        .limit(1000),
      supabase
        .from("commitments")
        .select("id, contact_id, direction, status, due_at, completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("completed_at", since)
        .limit(1000),
      supabase
        .from("commitments")
        .select("id, contact_id, direction, status, due_at, completed_at")
        .eq("user_id", user.id)
        .eq("status", "open")
        .eq("direction", "user_owes")
        .lte("due_at", dueSoon)
        .limit(1000),
      supabase
        .from("intro_requests")
        .select("id, target_contact_id, status, introduced_at, meeting_booked_at")
        .eq("user_id", user.id)
        .limit(1000),
    ])

    if (contactsRes.error) {
      log("error", "Investor update contacts query failed", { action: "investor_update", route: ROUTE, userId: user.id, error: contactsRes.error.message })
      return errorResponse("Could not load your pipeline")
    }

    const stats = buildInvestorUpdateStats(
      {
        contacts: (contactsRes.data || []) as UpdateContactRow[],
        activities: (activitiesRes.data || []) as UpdateActivityRow[],
        commitments: [...(completedRes.data || []), ...(openRes.data || [])] as UpdateCommitmentRow[],
        introRequests: (introsRes.data || []) as UpdateIntroRow[],
      },
      input.period_days,
      now
    )

    let draft: string
    let fallback = false
    try {
      const result = await generateStructuredOutput<{ draft?: unknown }>({
        name: "investor_update",
        schema: INVESTOR_UPDATE_SCHEMA as unknown as Record<string, unknown>,
        system: INVESTOR_UPDATE_SYSTEM,
        user: buildInvestorUpdatePrompt(stats, input),
        maxTokens: input.tone === "detailed" ? 1200 : 700,
      })
      if (typeof result?.draft !== "string" || !result.draft.trim()) throw new Error("Empty draft")
      draft = cleanDraft(result.draft).slice(0, 8000)
    } catch (error) {
      log("warn", "Investor update generation failed, using template", {
        action: "investor_update",
        route: ROUTE,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      })
      draft = buildFallbackDraft(stats, input)
      fallback = true
    }

    log("info", "Investor update drafted", { action: "investor_update", route: ROUTE, userId: user.id, fallback })

    return NextResponse.json({ draft, stats, fallback })
  } catch (error) {
    log("error", "Investor update error", { action: "investor_update", route: ROUTE, error: String(error) })
    return errorResponse("Internal server error")
  }
}
