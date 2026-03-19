import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractContactInfo } from "@/lib/extract-contact"
import { checkContactLimit } from "@/lib/subscription"
import { calculateHealthScore } from "@/lib/health"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Rate limit: 20 contact creations per minute (AI extraction is expensive)
    const rl = await rateLimit(user.id, "create")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    // Check contact limit based on plan
    const { allowed, plan, count, limit } = await checkContactLimit(user.id)
    if (!allowed) {
      return NextResponse.json(
        {
          message: `You've reached the ${limit}-contact limit on the free plan. Upgrade to Pro for unlimited contacts.`,
          plan,
          count,
          limit,
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { raw_note } = body

    if (!raw_note || typeof raw_note !== "string") {
      return NextResponse.json(
        { message: "raw_note is required" },
        { status: 400 }
      )
    }

    if (raw_note.trim().length < 3) {
      return NextResponse.json(
        { message: "Please write a bit more about this contact" },
        { status: 400 }
      )
    }

    // Extract contact info directly via OpenAI (no n8n dependency)
    const extracted = await extractContactInfo(raw_note)

    // Generate embedding for semantic search
    let embedding = null
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey) {
      try {
        const embeddingText = `${extracted.name || ""} ${extracted.company || ""} ${extracted.job_title || ""} ${raw_note}`
        const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: embeddingText,
          }),
        })
        if (embeddingRes.ok) {
          const embeddingData = await embeddingRes.json()
          embedding = embeddingData.data[0].embedding
        }
      } catch {
        // Embedding generation failed — non-critical, contact still saves
      }
    }

    // Insert contact into database
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
      return NextResponse.json(
        { message: error.message?.includes("Free plan limit") ? error.message : "Failed to save contact" },
        { status: error.message?.includes("Free plan limit") ? 403 : 500 }
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

    return NextResponse.json({
      success: true,
      contact,
    })
  } catch (error) {
    console.error("Error creating contact:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Rate limit: 60 requests per minute
    const rl = await rateLimit(user.id, "general")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching contacts:", error)
      return NextResponse.json(
        { message: "Failed to fetch contacts" },
        { status: 500 }
      )
    }

    // Add health scores to each contact
    const contactsWithHealth = (contacts || []).map((contact) => ({
      ...contact,
      health: calculateHealthScore(contact.last_contact_date, contact.created_at),
    }))

    return NextResponse.json({ contacts: contactsWithHealth })
  } catch (error) {
    console.error("Error fetching contacts:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
