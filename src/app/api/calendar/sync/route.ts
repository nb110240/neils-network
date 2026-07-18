import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import { safeCompare } from "@/lib/api-utils"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/openai"
import { analyzeInteraction } from "@/lib/action-extraction"
import { hashMeetingContent, htmlToPlainText } from "@/lib/meeting-content"

interface CalendarReviewCandidate {
  contactId: string
  eventId: string
  title: string
  occurredAt: string
  rawText: string
  contact: {
    name: string | null
    email: string | null
    company: string | null
    job_title: string | null
    how_we_met: string | null
    next_steps: string | null
  }
}

const MAX_CALENDAR_SYNCS_PER_CRON = 3

// Manual sync: user triggers from dashboard
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if ((await getUserPlan(user.id)) === "free") {
      return NextResponse.json({ error: "Calendar sync is a Pro feature" }, { status: 403 })
    }

    // Rate limit: 5 manual syncs per hour per user
    const rl = await rateLimit(`calendar-sync:${user.id}`, "import")
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many sync requests. Try again later." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const result = await syncCalendarForUser(user.id, user.email || "")
    return NextResponse.json(result)
  } catch (error) {
    console.error("Calendar sync error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Cron sync: called from Vercel cron every 6 hours
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!cronSecret || !token || !safeCompare(token, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = await createServiceClient()

    const { data: integrations } = await supabase
      .from("integrations")
      .select("id, user_id")
      .eq("provider", "google_calendar")
      .order("last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(MAX_CALENDAR_SYNCS_PER_CRON)

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ message: "No calendar integrations", synced: 0 })
    }

    let synced = 0
    // The query itself is capped, so total work is bounded even as the user
    // base grows. Oldest-attempted integrations rotate to the front.
    for (let index = 0; index < integrations.length; index += 3) {
      const batch = integrations.slice(index, index + 3)
      const results = await Promise.all(batch.map(async ({ id, user_id }) => {
        await supabase
          .from("integrations")
          .update({ last_attempt_at: new Date().toISOString() })
          .eq("id", id)
        try {
          const plan = await getUserPlan(user_id)
          if (plan === "free") {
            await supabase.from("integrations").update({ last_sync_error: "Plan does not include calendar sync" }).eq("id", id)
            return false
          }
          const { data: { user } } = await supabase.auth.admin.getUserById(user_id)
          if (!user?.email) return false
          const result = await syncCalendarForUser(user_id, user.email)
          if (!result.success) {
            await supabase.from("integrations").update({ last_sync_error: result.message || "Calendar sync did not complete" }).eq("id", id)
            return false
          }
          await supabase.from("integrations").update({ last_sync_error: null }).eq("id", id)
          return true
        } catch (err) {
          console.error(`Calendar sync failed for user ${user_id}:`, err)
          await supabase.from("integrations").update({ last_sync_error: String(err).slice(0, 500) }).eq("id", id)
          return false
        }
      }))
      synced += results.filter(Boolean).length
    }

    return NextResponse.json({ success: true, synced })
  } catch (error) {
    console.error("Calendar cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function syncCalendarForUser(userId: string, userEmail: string) {
  const supabase = await createServiceClient()

  // Get integration tokens
  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .single()

  if (!integration) {
    return { message: "No calendar connected", newContacts: 0 }
  }

  // Refresh token if expired
  let accessToken = integration.access_token
  if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
    if (!integration.refresh_token) {
      return { message: "Token expired, please reconnect", newContacts: 0 }
    }

    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: integration.refresh_token,
        grant_type: "refresh_token",
      }),
    })

    if (!refreshRes.ok) {
      return { message: "Failed to refresh token, please reconnect", newContacts: 0 }
    }

    const newTokens = await refreshRes.json()
    accessToken = newTokens.access_token

    await supabase
      .from("integrations")
      .update({
        access_token: newTokens.access_token,
        token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      })
      .eq("id", integration.id)
  }

  // Fetch events from last 30 days
  const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date().toISOString()

  const eventsRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!eventsRes.ok) {
    console.error("Failed to fetch calendar events:", await eventsRes.text())
    return { message: "Failed to fetch events", newContacts: 0 }
  }

  const eventsData = await eventsRes.json()
  const events = eventsData.items || []

  // Get existing contacts for this user (to avoid duplicates)
  // Check both email AND name to catch contacts added without email
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("id, email, name, company, job_title, how_we_met, next_steps")
    .eq("created_by", userId)
    .is("archived_at", null)

  // Build an email-keyed candidate map. Email is the only identifier we
  // trust for automatic linking — name/fuzzy/prefix heuristics have a
  // non-zero false-positive rate and silently corrupt relationship history
  // when they miss. Ambiguous or name-only cases fall through to the
  // "create new" path, and the user can reconcile via the duplicate-
  // review UI (which is built for this exact workflow).
  function pushToMap<K>(m: Map<K, string[]>, k: K, v: string) {
    const list = m.get(k)
    if (list) list.push(v)
    else m.set(k, [v])
  }

  const emailToContactIds = new Map<string, string[]>()
  const contactById = new Map<string, {
    name: string | null
    email: string | null
    company: string | null
    job_title: string | null
    how_we_met: string | null
    next_steps: string | null
  }>()
  for (const c of existingContacts || []) {
    if (c.email) pushToMap(emailToContactIds, c.email.toLowerCase(), c.id)
    contactById.set(c.id, c)
  }

  const emailMatchState = (
    email: string
  ): { kind: "none" } | { kind: "unique"; id: string } | { kind: "ambiguous" } => {
    const list = emailToContactIds.get(email)
    if (!list || list.length === 0) return { kind: "none" }
    if (list.length === 1) return { kind: "unique", id: list[0] }
    return { kind: "ambiguous" }
  }

  let newContacts = 0
  let skippedAmbiguous = 0
  const ambiguousEmails = new Set<string>()
  const userEmailLower = userEmail.toLowerCase()
  const pendingEmbeddings: Array<{
    id: string
    name: string
    email: string
    rawNote: string
    how_we_met: string
  }> = []
  const reviewCandidates: CalendarReviewCandidate[] = []

  const queueReview = (
    event: Record<string, unknown>,
    contactId: string,
    fallbackContact: CalendarReviewCandidate["contact"]
  ) => {
    const eventId = typeof event.id === "string" ? event.id : ""
    const description = typeof event.description === "string" ? htmlToPlainText(event.description) : ""
    if (!eventId || description.length < 20) return

    const start = event.start as { dateTime?: string; date?: string } | undefined
    const occurredAt = start?.dateTime || (start?.date ? `${start.date}T12:00:00.000Z` : "")
    if (!occurredAt) return

    reviewCandidates.push({
      contactId,
      eventId,
      title: typeof event.summary === "string" && event.summary.trim()
        ? event.summary.trim().slice(0, 200)
        : "Calendar meeting",
      occurredAt,
      rawText: description.slice(0, 100000),
      contact: contactById.get(contactId) || fallbackContact,
    })
  }

  for (const event of events) {
    const attendees = event.attendees || []

    // Only process 1:1 meetings (exactly 2 attendees including the user)
    if (attendees.length !== 2) continue

    // Find the other person (not the user)
    const otherPerson = attendees.find(
      (a: { email: string }) => a.email.toLowerCase() !== userEmailLower
    )
    if (!otherPerson) continue

    const otherEmail = otherPerson.email.toLowerCase()

    // Automatic linking is gated on exact email match only. Name-based
    // heuristics would silently corrupt relationship history — both the
    // timeline and the health score feeding the daily digest. If no
    // email match, fall through to "create new" and let the user
    // reconcile via the duplicate-review UI.
    const emailState = emailMatchState(otherEmail)

    // If the user already has multiple contacts with this email (data
    // already split — probably from an earlier sync bug), neither update
    // nor insert is safe: updating picks an arbitrary contact, inserting
    // amplifies the duplicate. Skip and let the user merge via the
    // duplicate-review UI before sync touches this email again.
    if (emailState.kind === "ambiguous") {
      console.warn(
        `calendar-sync: skipping event for ambiguous email (${emailToContactIds.get(otherEmail)?.length} contacts share ${otherEmail})`
      )
      skippedAmbiguous++
      ambiguousEmails.add(otherEmail)
      continue
    }

    if (emailState.kind === "unique") {
      const matchedContactId = emailState.id
      const eventDate = event.start?.dateTime?.split("T")[0] || event.start?.date
      const eventSummary = event.summary || "Calendar meeting"

      if (eventDate) {
        // Update last_contact_date if this meeting is more recent. Do not
        // touch the email since the match was already exact-email.
        await supabase
          .from("contacts")
          .update({ last_contact_date: eventDate })
          .eq("id", matchedContactId)
          .eq("created_by", userId)
          .lt("last_contact_date", eventDate)

        // Create a meeting activity on the contact's timeline. The unique
        // index on (contact_id, source, source_event_id) lets us upsert
        // safely — re-runs of this sync (manual retry, scheduled rerun,
        // concurrent tabs) silently skip duplicates instead of stacking.
        if (event.id) {
          await supabase
            .from("contact_activities")
            .upsert(
              {
                contact_id: matchedContactId,
                user_id: userId,
                type: "meeting",
                content: `Calendar: ${eventSummary}`,
                occurred_at: `${eventDate}T12:00:00`,
                follow_up_needed: false,
                source: "google_calendar",
                source_event_id: event.id,
              },
              { onConflict: "contact_id,source,source_event_id", ignoreDuplicates: true }
            )
        }
      }
      queueReview(event, matchedContactId, {
        name: otherPerson.displayName || null,
        email: otherPerson.email || null,
        company: null,
        job_title: null,
        how_we_met: null,
        next_steps: null,
      })
      continue
    }

    // Create new contact from 1:1 meeting. Embeddings are generated
    // after the loop so a slow OpenAI response doesn't multiply per event
    // and time out the whole sync.
    const name = otherPerson.displayName || otherEmail.split("@")[0]
    const eventDate = event.start?.dateTime?.split("T")[0] || event.start?.date
    const eventSummary = event.summary || "Calendar meeting"
    const rawNote = `Met via calendar: "${eventSummary}" on ${eventDate}`

    const { data: insertedRows, error } = await supabase
      .from("contacts")
      .insert({
        name,
        email: otherPerson.email,
        raw_note: rawNote,
        how_we_met: `1:1 meeting: ${eventSummary}`,
        last_contact_date: eventDate,
        source: "google_calendar",
        created_by: userId,
        follow_up_needed: false,
        embedding_status: "pending",
      })
      .select("id")

    if (!error && insertedRows && insertedRows[0]) {
      const newId = insertedRows[0].id as string
      // Register the new contact's email so a second event for the same
      // person in this run links instead of duplicating.
      pushToMap(emailToContactIds, otherEmail, newId)
      const newContactContext = {
        name,
        email: otherPerson.email,
        company: null,
        job_title: null,
        how_we_met: `1:1 meeting: ${eventSummary}`,
        next_steps: null,
      }
      contactById.set(newId, newContactContext)
      queueReview(event, newId, newContactContext)
      pendingEmbeddings.push({ id: newId, name, email: otherPerson.email, rawNote, how_we_met: `1:1 meeting: ${eventSummary}` })
      newContacts++
    } else if (error && (error.code === "23505" || /duplicate key|unique/i.test(error.message || ""))) {
      // A concurrent sync (overlapping cron, user-triggered retry, or
      // second tab) beat us to the insert. The unique index on
      // (created_by, lower(email)) blocks the second write. Re-fetch the
      // existing contact and attach this event's activity to it so the
      // sync stays forward-progressing instead of dead-ending on this
      // email for every subsequent run.
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("created_by", userId)
        .ilike("email", otherPerson.email)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle()

      if (existing?.id && event.id && eventDate) {
        pushToMap(emailToContactIds, otherEmail, existing.id as string)
        await supabase
          .from("contacts")
          .update({ last_contact_date: eventDate })
          .eq("id", existing.id)
          .eq("created_by", userId)
          .lt("last_contact_date", eventDate)
        await supabase.from("contact_activities").upsert(
          {
            contact_id: existing.id,
            user_id: userId,
            type: "meeting",
            content: `Calendar: ${eventSummary}`,
            occurred_at: `${eventDate}T12:00:00`,
            follow_up_needed: false,
            source: "google_calendar",
            source_event_id: event.id,
          },
          { onConflict: "contact_id,source,source_event_id", ignoreDuplicates: true }
        )
        queueReview(event, existing.id as string, {
          name,
          email: otherPerson.email,
          company: null,
          job_title: null,
          how_we_met: null,
          next_steps: null,
        })
      }
    }
  }

  // Calendar notes are useful context, but they are never allowed to mutate
  // CRM data directly. Analyze at most five new notes per sync and put the
  // proposals in the same human approval inbox as pasted notes.
  const reviewsCreated = await createCalendarReviews(
    reviewCandidates
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    userId,
    userEmail,
    supabase
  )

  // Update last sync time
  await supabase
    .from("integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", integration.id)

  // Fire-and-forget embedding generation so OpenAI latency doesn't block
  // the sync response. Status stays "pending" on failure and the existing
  // re-embed cron will retry later.
  if (pendingEmbeddings.length > 0) {
    embedNewCalendarContacts(pendingEmbeddings, supabase).catch((err) => {
      console.error("calendar-sync: background embedding failed", err)
    })
  }

  return {
    success: true,
    newContacts,
    reviewsCreated,
    eventsProcessed: events.length,
    skippedAmbiguous,
    // Include the actual emails so the UI can link into duplicate-review
    // with the right filter instead of forcing the user to hunt.
    ambiguousEmails: Array.from(ambiguousEmails),
  }
}

async function createCalendarReviews(
  candidates: CalendarReviewCandidate[],
  userId: string,
  userEmail: string,
  supabase: Awaited<ReturnType<typeof createServiceClient>>
): Promise<number> {
  if (candidates.length === 0) return 0

  const { data: existing } = await supabase
    .from("after_call_reviews")
    .select("external_source_id")
    .eq("user_id", userId)
    .eq("source", "calendar")

  const existingIds = new Set(
    (existing || []).map((review: { external_source_id: string | null }) => review.external_source_id)
  )
  const unseenCandidates = candidates
    .filter((candidate) => !existingIds.has(candidate.eventId))
    .slice(0, 5)
  const results = await Promise.all(unseenCandidates.map(async (candidate) => {
    try {
      const analysis = await analyzeInteraction({
        rawText: candidate.rawText,
        title: candidate.title,
        occurredAt: candidate.occurredAt,
        existingContact: candidate.contact,
        userName: userEmail.split("@")[0] || null,
      })
      const { error } = await supabase.from("after_call_reviews").insert({
        user_id: userId,
        contact_id: candidate.contactId,
        source: "calendar",
        external_source_id: candidate.eventId,
        title: candidate.title,
        occurred_at: candidate.occurredAt,
        raw_text: candidate.rawText,
        content_hash: hashMeetingContent(candidate.rawText),
        summary: analysis.summary,
        proposed_contact_patch: analysis.contactPatch,
        proposed_commitments: analysis.commitments,
        proposed_follow_up: analysis.followUpDraft,
      })
      if (!error) return true
      if (error.code !== "23505") console.error("calendar-sync review insert failed:", error.message)
    } catch (error) {
      // A single malformed description or transient model failure must not
      // prevent contact sync. The next sync can retry because no review exists.
      console.error(`calendar-sync review analysis failed for ${candidate.eventId}:`, error)
    }
    return false
  }))

  return results.filter(Boolean).length
}

async function embedNewCalendarContacts(
  contacts: Array<{
    id: string
    name: string
    email: string
    rawNote: string
    how_we_met: string
  }>,
  supabase: Awaited<ReturnType<typeof createServiceClient>>
) {
  for (const c of contacts) {
    const embeddingText = buildContactEmbeddingText({
      name: c.name,
      company: null,
      job_title: null,
      email: c.email,
      how_we_met: c.how_we_met,
      next_steps: null,
      raw_note: c.rawNote,
    })
    try {
      const embedding = await generateEmbedding(embeddingText)
      await supabase
        .from("contacts")
        .update({
          embedding: embedding || undefined,
          embedding_status: embedding ? "complete" : "failed",
        })
        .eq("id", c.id)
    } catch (err) {
      console.error(`calendar-sync embedding failed for ${c.id}`, err)
      await supabase
        .from("contacts")
        .update({ embedding_status: "failed" })
        .eq("id", c.id)
    }
  }
}
