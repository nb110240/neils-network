import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeInteraction } from "@/lib/action-extraction"
import { getGranolaNote, granolaNoteToMeetingText, listGranolaNotes } from "@/lib/granola"
import { hashMeetingContent } from "@/lib/meeting-content"
import { fetchAllRows } from "@/lib/fetch-all"

// ─── Granola → Review Inbox ───
// One sync pass for one user, shared by "Sync now" in Settings and the
// nightly cron. Notes become pending after-call reviews; nothing is applied
// to contacts until the user approves it.

export const MAX_NOTES_PER_SYNC = 10
const LIST_PAGES = 4
const LIST_PAGE_SIZE = 30
const FIRST_SYNC_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000
const RESYNC_OVERLAP_MS = 60 * 60 * 1000

export interface GranolaIntegration {
  id: string
  access_token: string
  last_sync_at: string | null
}

export interface GranolaSyncResult {
  imported: number
  skipped: number
  failed: number
  hasMore: boolean
}

export async function syncGranolaForUser(
  service: SupabaseClient,
  user: { id: string; email?: string | null },
  integration: GranolaIntegration
): Promise<GranolaSyncResult> {
  const createdAfter = integration.last_sync_at
    ? new Date(new Date(integration.last_sync_at).getTime() - RESYNC_OVERLAP_MS).toISOString()
    : new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS).toISOString()
  // Scan enough metadata pages to move past notes that were already reviewed,
  // but analyze at most ten new notes per pass to keep cost and latency bounded.
  const listedNotes: Awaited<ReturnType<typeof listGranolaNotes>>["notes"] = []
  let cursor: string | undefined
  let apiHasMore = false
  for (let pageNumber = 0; pageNumber < LIST_PAGES; pageNumber++) {
    const page = await listGranolaNotes(integration.access_token, createdAfter, LIST_PAGE_SIZE, cursor)
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

  // Paged: the API returns at most 1,000 rows per request.
  const { data: contacts } = await fetchAllRows((from, to) =>
    service
      .from("contacts")
      .select("id, name, email, company, job_title, how_we_met, next_steps")
      .eq("created_by", user.id)
      .is("archived_at", null)
      .order("id", { ascending: true })
      .range(from, to)
  )
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
    if (attempted >= MAX_NOTES_PER_SYNC) break
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

  const hasMore = apiHasMore || listedNotes.some((note) => !settledIds.has(note.id))
  if (!hasMore) {
    await service
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id)
      .eq("user_id", user.id)
  }

  return { imported, skipped, failed, hasMore }
}
