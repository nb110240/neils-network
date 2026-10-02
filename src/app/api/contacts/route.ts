import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse, forbiddenResponse } from "@/lib/api-utils"
import { extractContactInfo } from "@/lib/extract-contact"
import { checkContactLimit } from "@/lib/subscription"
import { calculateHealthScore, computeNextDueDate } from "@/lib/health"
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/openai"
import { findDuplicates, findStrongMatch, namesAgree } from "@/lib/dedup"
import { CONTACT_COLUMNS } from "@/lib/contact-columns"
import { log } from "@/lib/logger"
import { suggestNameFromNote } from "@/lib/name-from-note"

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("create")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const url = new URL(request.url)
    const skipDedup = url.searchParams.get("skip_dedup") === "true"

    const body = await request.json()
    const { raw_note } = body

    if (!raw_note || typeof raw_note !== "string") {
      return badRequestResponse("raw_note is required")
    }

    if (raw_note.trim().length < 3) {
      return badRequestResponse("Please write a bit more about this contact")
    }

    if (raw_note.length > 20000) {
      return badRequestResponse("Note too long (max 20,000 characters)")
    }

    // Extract contact info via AI
    const extracted = await extractContactInfo(raw_note)

    // A name typed by the user (after the prompt below) wins over extraction.
    const providedName = typeof body.name === "string" ? body.name.trim().slice(0, 200) : ""
    if (providedName) extracted.name = providedName

    // Never save a nameless contact. When extraction fails (AI outage) or the
    // note has no name, ask for one instead of creating "Unnamed contact",
    // which also fired activation analytics for a contact nobody can find.
    if (typeof extracted.name !== "string" || !extracted.name.trim()) {
      // Notes queued offline sync in the background with nobody to ask, so
      // keep them (best-guess name or none) rather than dropping the note.
      if (body.allow_unnamed === true) {
        extracted.name = suggestNameFromNote(raw_note)
      } else {
        // A capped free user should hear about the limit first, not type a
        // name only to be told they can't add anyone.
        const { allowed, limit } = await checkContactLimit(user.id)
        if (!allowed) {
          return forbiddenResponse(
            `You've reached the ${limit}-contact limit on the free plan. Upgrade to Pro for unlimited contacts.`
          )
        }
        return NextResponse.json(
          {
            error: "We couldn't find a name in that note. Add their name to save this contact.",
            needs_name: true,
            suggested_name: suggestNameFromNote(raw_note),
          },
          { status: 422 }
        )
      }
    }

    // Check for duplicates before inserting
    let duplicates: Awaited<ReturnType<typeof findDuplicates>> = []
    if (!skipDedup) {
      // Strong match check — block creation if high-confidence duplicate exists
      const strongMatch = await findStrongMatch(supabase, user.id, {
        name: extracted.name as string | null,
        email: extracted.email as string | null,
        phone: extracted.phone as string | null,
        company: extracted.company as string | null,
      })
      if (strongMatch) {
        // Secondary safety check: the free-form note may mention an
        // unrelated email (a forwarded meeting invite, an assistant's
        // address, etc.) and extractContactInfo would pull that into
        // `email`, so a single identifier hit alone is not enough to
        // mutate an existing contact. Confirm the extracted name agrees
        // with the matched contact; if it clearly disagrees, route the
        // decision to the user via a 409 conflict instead of silently
        // attaching the note to the wrong person.
        const { data: matchedContact } = await supabase
          .from("contacts")
          .select("name, last_contact_date, scheduled_follow_up, cadence_days, created_at")
          .eq("id", strongMatch.contactId)
          .eq("created_by", user.id)
          .is("archived_at", null)
          .maybeSingle()

        if (!namesAgree(extracted.name as string | null, matchedContact?.name ?? null)) {
          return NextResponse.json(
            {
              conflict: true,
              reason: "name_mismatch",
              message: `An existing contact (${matchedContact?.name ?? "unnamed"}) shares this ${strongMatch.reason.toLowerCase().replace("same ", "")}, but the name in your note ("${extracted.name}") is different. Open that contact to update it, or change the email/phone in your note to create a new one.`,
              candidate: {
                contactId: strongMatch.contactId,
                contactName: matchedContact?.name ?? null,
                reason: strongMatch.reason,
              },
              extracted,
            },
            { status: 409 }
          )
        }

        // Add the note as an activity on the existing contact instead of
        // creating a duplicate. Deterministic source_event_id makes the
        // insert idempotent across client retries: same (contact, raw_note,
        // day) combo always produces the same key, and the partial unique
        // index on (contact_id, source, source_event_id) turns a retry
        // into a no-op instead of stacking duplicate timeline entries.
        const today = new Date().toISOString().split("T")[0]
        const dedupeKey = createHash("sha256")
          .update(`${strongMatch.contactId}|${today}|${raw_note}`)
          .digest("hex")

        const { error: activityError } = await supabase
          .from("contact_activities")
          .upsert(
            {
              contact_id: strongMatch.contactId,
              user_id: user.id,
              type: "note",
              content: raw_note,
              occurred_at: `${today}T12:00:00`,
              follow_up_needed: !!(extracted.follow_up_needed),
              source: "auto_merge",
              source_event_id: dedupeKey,
            },
            { onConflict: "contact_id,source,source_event_id", ignoreDuplicates: true }
          )
        if (activityError) {
          log("error", "auto-merge: activity insert failed", {
            action: "contacts.auto_merge",
            contactId: strongMatch.contactId,
            error: activityError.message,
          })
          return errorResponse("Failed to attach note to existing contact")
        }

        // Update contact-level scheduling invariants alongside
        // last_contact_date. This mirrors what POST
        // /api/contacts/[id]/activities does for manual activity writes,
        // so a merged note doesn't leave the contact incorrectly snoozed,
        // with a stale next_due_date, or missing a follow-up flag.
        const scheduledFollowUp = matchedContact?.scheduled_follow_up as string | null | undefined
        const todayDate = new Date(today)
        const clearScheduledFollowUp = scheduledFollowUp
          ? new Date(scheduledFollowUp) <= todayDate
          : false

        const updates: Record<string, unknown> = {
          last_contact_date: today,
          follow_up_needed: !!(extracted.follow_up_needed),
          // New interaction supersedes any prior snooze.
          snoozed_until: null,
        }
        if (clearScheduledFollowUp) {
          updates.scheduled_follow_up = null
        }
        updates.next_due_date = computeNextDueDate(
          today,
          (matchedContact?.created_at as string | undefined) ?? today,
          (matchedContact?.cadence_days as number | null | undefined) ?? null,
          clearScheduledFollowUp ? null : (scheduledFollowUp ?? null)
        )

        const { error: updateError } = await supabase
          .from("contacts")
          .update(updates)
          .eq("id", strongMatch.contactId)
          .eq("created_by", user.id)
        if (updateError) {
          log("error", "auto-merge: contact update failed", {
            action: "contacts.auto_merge",
            contactId: strongMatch.contactId,
            error: updateError.message,
          })
          return errorResponse("Failed to update existing contact")
        }

        revalidatePath("/dashboard")
        revalidatePath("/reach-out")
        revalidatePath("/contacts")

        return NextResponse.json({
          success: true,
          merged: true,
          contactId: strongMatch.contactId,
          message: `This looks like ${strongMatch.reason.toLowerCase()}. Added your note to the existing contact instead of creating a duplicate.`,
        }, { status: 200 })
      }

      duplicates = await findDuplicates(supabase, user.id, {
        name: extracted.name as string | null,
        email: extracted.email as string | null,
        phone: extracted.phone as string | null,
        company: extracted.company as string | null,
      })
      // Filter to only meaningful matches
      duplicates = duplicates.filter((d) => d.score >= 0.6)
    }

    // Enforce the contact limit only on the create path — merging into an
    // existing contact (handled above) must work even when the user is at
    // the cap, otherwise capped free users can't log new interactions on
    // their existing network, which is the most valuable thing the app
    // does. The merge path returned before this check runs.
    const { allowed, limit } = await checkContactLimit(user.id)
    if (!allowed) {
      return forbiddenResponse(
        `You've reached the ${limit}-contact limit on the free plan. Upgrade to Pro for unlimited contacts.`
      )
    }

    // Generate embedding for semantic search
    const embeddingText = buildContactEmbeddingText({
      name: extracted.name as string | null,
      company: extracted.company as string | null,
      job_title: extracted.job_title as string | null,
      email: extracted.email as string | null,
      how_we_met: extracted.how_we_met as string | null,
      next_steps: extracted.next_steps as string | null,
      raw_note,
    })
    const embedding = await generateEmbedding(embeddingText)

    const embeddingStatus = embedding ? "complete" : "failed"

    // Insert contact
    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        ...extracted,
        raw_note,
        embedding,
        embedding_status: embeddingStatus,
        source: "web",
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      log("error", "Failed to insert contact", { userId: user.id, action: "contact.create", route: "/api/contacts", error: error.message })
      return errorResponse(
        error.message?.includes("Free plan limit") ? error.message : "Failed to save contact",
        error.message?.includes("Free plan limit") ? 403 : 500
      )
    }

    log("info", "Contact created", {
      userId: user.id,
      action: "contact.create",
      route: "/api/contacts",
      contactId: contact?.id,
      extractionSuccess: !!extracted.name,
      embeddingStatus,
    })

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")

    // If there's an active event, associate this contact with it
    if (contact?.id) {
      try {
        const { data: activeEvent } = await supabase
          .from("events")
          .select("id")
          .eq("created_by", user.id)
          .eq("is_active", true)
          .gt("ends_at", new Date().toISOString())
          .limit(1)
          .single()

        if (activeEvent) {
          const { data: updated } = await supabase
            .from("contacts")
            .update({ event_id: activeEvent.id })
            .eq("id", contact.id)
            .select()
            .single()
          if (updated) {
            return NextResponse.json({
              success: true,
              contact: updated,
              ...(duplicates.length > 0 ? { duplicates } : {}),
            })
          }
        }
      } catch {
        // No active event, that's fine
      }
    }

    return NextResponse.json({
      success: true,
      contact,
      ...(duplicates.length > 0 ? { duplicates } : {}),
    })
  } catch (error) {
    log("error", "Unhandled error creating contact", { action: "contact.create", route: "/api/contacts", error: String(error) })
    return errorResponse("Internal server error")
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get("limit")
    const cursor = searchParams.get("cursor")
    const direction = searchParams.get("direction") || "next"

    // If no limit param, return all contacts (backward compat for dashboard)
    if (!limitParam) {
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select(CONTACT_COLUMNS)
        .eq("created_by", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching contacts:", error)
        return errorResponse("Failed to fetch contacts")
      }

      const contactsWithHealth = (contacts || []).map((contact) => ({
        ...contact,
        health: calculateHealthScore(contact.last_contact_date, contact.created_at),
      }))

      return NextResponse.json({ contacts: contactsWithHealth })
    }

    // Paginated path
    const limit = Math.min(Math.max(1, parseInt(limitParam, 10) || 25), 100)

    // Get total count (exclude archived)
    const { count: total, error: countError } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("created_by", user.id)
      .is("archived_at", null)

    if (countError) {
      console.error("Error counting contacts:", countError)
      return errorResponse("Failed to fetch contacts")
    }

    // Build paginated query (exclude archived)
    // Ordered by created_at DESC (most recent first)
    // direction=next: older items (created_at < cursor)
    // direction=prev: newer items (created_at > cursor), then reverse
    let query = supabase
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("created_by", user.id)
      .is("archived_at", null)

    if (cursor) {
      if (direction === "prev") {
        query = query.gt("created_at", cursor).order("created_at", { ascending: true })
      } else {
        query = query.lt("created_at", cursor).order("created_at", { ascending: false })
      }
    } else {
      query = query.order("created_at", { ascending: false })
    }

    // Fetch one extra to determine hasMore
    const { data: contacts, error } = await query.limit(limit + 1)

    if (error) {
      console.error("Error fetching contacts:", error)
      return errorResponse("Failed to fetch contacts")
    }

    let results = contacts || []
    const hasMore = results.length > limit
    if (hasMore) {
      results = results.slice(0, limit)
    }

    // For prev direction, we queried ascending — reverse to maintain DESC order
    if (direction === "prev") {
      results.reverse()
    }

    const contactsWithHealth = results.map((contact) => ({
      ...contact,
      health: calculateHealthScore(contact.last_contact_date, contact.created_at),
    }))

    const firstItem = contactsWithHealth[0]
    const lastItem = contactsWithHealth[contactsWithHealth.length - 1]

    // nextCursor: created_at of the last item (to get older items)
    // prevCursor: created_at of the first item (to get newer items)
    const nextCursor = hasMore && lastItem ? lastItem.created_at : null
    const prevCursor = cursor && firstItem ? firstItem.created_at : null

    return NextResponse.json({
      contacts: contactsWithHealth,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor,
        total: total || 0,
      },
    })
  } catch (error) {
    console.error("Error fetching contacts:", error)
    return errorResponse("Internal server error")
  }
}
