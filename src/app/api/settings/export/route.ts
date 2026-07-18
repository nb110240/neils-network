import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { log } from "@/lib/logger"
import { createServiceClient } from "@/lib/supabase/server"

/**
 * GDPR Art. 20 data portability: return everything a user owns as JSON,
 * so they can leave (or back up) without having to ask anyone. All
 * queries are scoped by the authenticated user's id via RLS.
 */
export async function GET() {
  try {
    const auth = await authenticateRequest("export")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth
    const service = await createServiceClient()

    const [contacts, activities, tags, contactTags, events, preferences, integrations, usage, reviews, commitments, researchReports, introRequests] =
      await Promise.all([
        supabase.from("contacts").select("*").eq("created_by", user.id),
        supabase.from("contact_activities").select("*").eq("user_id", user.id),
        supabase.from("tags").select("*").eq("created_by", user.id),
        supabase
          .from("contact_tags")
          .select("*, contacts!inner(created_by)")
          .eq("contacts.created_by", user.id),
        supabase.from("events").select("*").eq("created_by", user.id),
        supabase.from("user_preferences").select("*").eq("user_id", user.id),
        service
          .from("integrations")
          .select("id, provider, created_at, last_sync_at, last_attempt_at")
          .eq("user_id", user.id),
        service
          .from("usage_counters")
          .select("ai_reviews_used, csv_contacts_imported, created_at, updated_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("after_call_reviews").select("*").eq("user_id", user.id),
        supabase.from("commitments").select("*").eq("user_id", user.id),
        supabase.from("investor_research_reports").select("*").eq("user_id", user.id),
        supabase.from("intro_requests").select("*").eq("user_id", user.id),
      ])

    const failedQuery = [contacts, activities, tags, contactTags, events, preferences, integrations, usage, reviews, commitments, researchReports, introRequests]
      .find((result) => result.error)
    if (failedQuery?.error) {
      throw new Error(`Export query failed: ${failedQuery.error.message}`)
    }

    const payload = {
      exported_at: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      contacts: contacts.data ?? [],
      contact_activities: activities.data ?? [],
      tags: tags.data ?? [],
      contact_tags: (contactTags.data ?? []).map((ct: Record<string, unknown>) => {
        const { contacts: _c, ...rest } = ct as { contacts?: unknown }
        void _c
        return rest
      }),
      events: events.data ?? [],
      user_preferences: preferences.data ?? [],
      integrations: integrations.data ?? [],
      free_usage: usage.data ?? null,
      after_call_reviews: reviews.data ?? [],
      commitments: commitments.data ?? [],
      investor_research_reports: researchReports.data ?? [],
      intro_requests: introRequests.data ?? [],
    }

    log("info", "data export", {
      action: "settings.export",
      route: "/api/settings/export",
      userId: user.id,
      contactCount: payload.contacts.length,
    })

    const filename = `savvo-export-${new Date().toISOString().split("T")[0]}.json`
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    log("error", "data export failed", {
      action: "settings.export",
      route: "/api/settings/export",
      error: err instanceof Error ? err.message : String(err),
    })
    return errorResponse("Failed to export data")
  }
}
