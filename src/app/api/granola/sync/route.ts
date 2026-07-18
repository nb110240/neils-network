import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  authenticateRequest,
  authFailed,
  errorResponse,
  forbiddenResponse,
} from "@/lib/api-utils"
import { analyzeInteraction } from "@/lib/action-extraction"
import { getGranolaNote, granolaNoteToMeetingText, listGranolaNotes } from "@/lib/granola"
import { hashMeetingContent } from "@/lib/meeting-content"
import { createServiceClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"

export async function POST() {
  try {
    const auth = await authenticateRequest("import")
    if (authFailed(auth)) return auth.error
    const { user } = auth
    if ((await getUserPlan(user.id)) === "free") return forbiddenResponse("Granola sync is a Pro feature")

    const service = await createServiceClient()
    const { data: integration } = await service
      .from("integrations")
      .select("id, access_token, last_sync_at")
      .eq("user_id", user.id)
      .eq("provider", "granola")
      .maybeSingle()

    if (!integration?.access_token) {
      return NextResponse.json({ error: "Connect Granola in Settings first" }, { status: 409 })
    }

    const createdAfter = integration.last_sync_at
      ? new Date(new Date(integration.last_sync_at).getTime() - 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    // Scan enough metadata pages to move past notes that were already reviewed,
    // but analyze at most ten new notes per request to keep cost and latency bounded.
    const listedNotes: Awaited<ReturnType<typeof listGranolaNotes>>["notes"] = []
    let cursor: string | undefined
    let apiHasMore = false
    for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
      const page = await listGranolaNotes(integration.access_token, createdAfter, 30, cursor)
      listedNotes.push(...page.notes)
      apiHasMore = page.hasMore
      if (!page.hasMore || !page.cursor) break
      cursor = page.cursor
    }

    const noteIds = listedNotes.map((note) => note.id)
    const { data: existingReviews } = noteIds.length
      ? await service
          .from("after_call_reviews")
          .select("external_source_id")
          .eq("user_id", user.id)
          .eq("source", "granola")
          .in("external_source_id", noteIds)
      : { data: [] }
    const existingIds = new Set(
      (existingReviews || []).map((review: { external_source_id: string | null }) => review.external_source_id)
    )
    const settledIds = new Set(existingIds)

    const { data: contacts } = await service
      .from("contacts")
      .select("id, name, email, company, job_title, how_we_met, next_steps")
      .eq("created_by", user.id)
      .is("archived_at", null)
    const contactsByEmail = new Map<string, typeof contacts>()
    for (const contact of contacts || []) {
      if (!contact.email) continue
      const email = contact.email.toLowerCase()
      contactsByEmail.set(email, [...(contactsByEmail.get(email) || []), contact])
    }

    let imported = 0
    let skipped = 0
    let failed = 0
    let attempted = 0
    for (const listedNote of listedNotes) {
      if (existingIds.has(listedNote.id)) {
        skipped++
        continue
      }
      if (attempted >= 10) break
      attempted++

      try {
        const note = await getGranolaNote(integration.access_token, listedNote.id)
        const rawText = granolaNoteToMeetingText(note)
        if (rawText.length < 20) {
          skipped++
          settledIds.add(listedNote.id)
          continue
        }

        const matchedContacts = note.attendees
          .flatMap((attendee) => contactsByEmail.get(attendee.email.toLowerCase()) || [])
          .filter((contact, index, all) => all.findIndex((item) => item.id === contact.id) === index)
        const matchedContact = matchedContacts.length === 1 ? matchedContacts[0] : null
        const title = (note.title || "Granola meeting").trim().slice(0, 200)
        const occurredAt = note.calendar_event?.scheduled_start_time || note.created_at
        const analysis = await analyzeInteraction({
          rawText,
          title,
          occurredAt,
          existingContact: matchedContact ? {
            name: matchedContact.name,
            email: matchedContact.email,
            company: matchedContact.company,
            job_title: matchedContact.job_title,
            how_we_met: matchedContact.how_we_met,
            next_steps: matchedContact.next_steps,
          } : null,
          userName: user.email?.split("@")[0] || null,
        })

        const { error } = await service.from("after_call_reviews").insert({
          user_id: user.id,
          contact_id: matchedContact?.id || null,
          source: "granola",
          external_source_id: note.id,
          title,
          occurred_at: occurredAt,
          raw_text: rawText,
          content_hash: hashMeetingContent(rawText),
          summary: analysis.summary,
          proposed_contact_patch: analysis.contactPatch,
          proposed_commitments: analysis.commitments,
          proposed_follow_up: analysis.followUpDraft,
        })
        if (!error) {
          imported++
          settledIds.add(listedNote.id)
        } else if (error.code === "23505") {
          skipped++
          settledIds.add(listedNote.id)
        }
        else failed++
      } catch (error) {
        console.error(`Granola note ${listedNote.id} sync failed:`, error)
        failed++
      }
    }

    const backlogRemains = apiHasMore || listedNotes.some((note) => !settledIds.has(note.id))
    if (!backlogRemains) {
      await service
        .from("integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", integration.id)
        .eq("user_id", user.id)
    }

    revalidatePath("/dashboard")
    revalidatePath("/inbox")
    return NextResponse.json({ imported, skipped, failed, has_more: backlogRemains })
  } catch (error) {
    console.error("Granola sync error:", error)
    return errorResponse(error instanceof Error ? error.message : "Could not sync Granola")
  }
}
