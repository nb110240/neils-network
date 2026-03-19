import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse, forbiddenResponse } from "@/lib/api-utils"
import { extractContactInfo } from "@/lib/extract-contact"
import { checkContactLimit } from "@/lib/subscription"
import { calculateHealthScore } from "@/lib/health"
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/openai"

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

    const body = await request.json()
    const { raw_note } = body

    if (!raw_note || typeof raw_note !== "string") {
      return badRequestResponse("raw_note is required")
    }

    if (raw_note.trim().length < 3) {
      return badRequestResponse("Please write a bit more about this contact")
    }

    // Extract contact info via AI
    const extracted = await extractContactInfo(raw_note)

    // Generate embedding for semantic search
    const embeddingText = buildContactEmbeddingText({
      name: extracted.name as string | null,
      company: extracted.company as string | null,
      job_title: extracted.job_title as string | null,
      raw_note,
    })
    const embedding = await generateEmbedding(embeddingText)

    // Insert contact
    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        ...extracted,
        raw_note,
        embedding,
        source: "web",
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("Error inserting contact:", error)
      return errorResponse(
        error.message?.includes("Free plan limit") ? error.message : "Failed to save contact",
        error.message?.includes("Free plan limit") ? 403 : 500
      )
    }

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
            return NextResponse.json({ success: true, contact: updated })
          }
        }
      } catch {
        // No active event, that's fine
      }
    }

    return NextResponse.json({ success: true, contact })
  } catch (error) {
    console.error("Error creating contact:", error)
    return errorResponse("Internal server error")
  }
}

export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("created_by", user.id)
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
  } catch (error) {
    console.error("Error fetching contacts:", error)
    return errorResponse("Internal server error")
  }
}
