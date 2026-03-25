import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse, forbiddenResponse } from "@/lib/api-utils"
import { extractContactInfo } from "@/lib/extract-contact"
import { checkContactLimit } from "@/lib/subscription"
import { calculateHealthScore } from "@/lib/health"
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/openai"
import { findDuplicates } from "@/lib/dedup"
import { log } from "@/lib/logger"

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("create")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // Check contact limit based on plan
    const { allowed, plan, count, limit } = await checkContactLimit(user.id)
    if (!allowed) {
      return forbiddenResponse(
        `You've reached the ${limit}-contact limit on the free plan. Upgrade to Pro for unlimited contacts.`
      )
    }

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

    // Check for duplicates before inserting
    let duplicates: Awaited<ReturnType<typeof findDuplicates>> = []
    if (!skipDedup) {
      duplicates = await findDuplicates(supabase, user.id, {
        name: extracted.name as string | null,
        email: extracted.email as string | null,
        phone: extracted.phone as string | null,
        company: extracted.company as string | null,
      })
      // Filter to only meaningful matches
      duplicates = duplicates.filter((d) => d.score >= 0.6)
    }

    // Generate embedding for semantic search
    const embeddingText = buildContactEmbeddingText({
      name: extracted.name as string | null,
      company: extracted.company as string | null,
      job_title: extracted.job_title as string | null,
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
        .select("*")
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
      .select("*")
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
