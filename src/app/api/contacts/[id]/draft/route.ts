import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Pro only
    const plan = await getUserPlan(user.id)
    if (plan === "free") {
      return NextResponse.json(
        { message: "AI drafts are a Pro feature. Upgrade to unlock." },
        { status: 403 }
      )
    }

    const rl = await rateLimit(user.id, "create")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    // Get the contact
    const { data: contact } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ message: "Contact not found" }, { status: 404 })
    }

    const { type } = await request.json()

    const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "there"

    let prompt: string

    if (type === "meeting") {
      // Get free time slots from calendar if connected
      let calendarContext = ""
      try {
        const serviceSupabase = await createServiceClient()
        const { data: integration } = await serviceSupabase
          .from("integrations")
          .select("access_token, token_expires_at")
          .eq("user_id", user.id)
          .eq("provider", "google_calendar")
          .single()

        if (integration?.access_token && new Date(integration.token_expires_at) > new Date()) {
          const now = new Date()
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

          const calRes = await fetch(
            `https://www.googleapis.com/calendar/v3/freeBusy`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${integration.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                timeMin: now.toISOString(),
                timeMax: nextWeek.toISOString(),
                items: [{ id: "primary" }],
              }),
            }
          )

          if (calRes.ok) {
            const calData = await calRes.json()
            const busySlots = calData.calendars?.primary?.busy || []
            calendarContext = `\n\nUser's busy times this week (avoid these):\n${busySlots.map((s: { start: string; end: string }) => `- ${s.start} to ${s.end}`).join("\n") || "No busy slots found — wide open."}`
          }
        }
      } catch {
        // Calendar not connected, that's fine
      }

      prompt = `Draft a short, warm message to schedule a 1:1 meeting with ${contact.name || "this person"}.

Context about this person:
- Name: ${contact.name || "Unknown"}
- Company: ${contact.company || "Unknown"}
- Role: ${contact.job_title || "Unknown"}
- How we met: ${contact.how_we_met || "Unknown"}
- Last interaction: ${contact.last_contact_date || "Unknown"}
- Notes: ${contact.raw_note?.slice(0, 300) || "None"}
${calendarContext}

Requirements:
- Suggest 3 specific time slots (if calendar data available, pick free slots; otherwise suggest generic times like "Tuesday afternoon" or "Thursday morning")
- Keep it casual and warm, not corporate
- Reference how you met or what you talked about
- Suggest coffee, call, or lunch
- Sign off as ${userName}
- Keep under 100 words`

    } else {
      // Follow-up message
      prompt = `Draft a short, personalized follow-up message to ${contact.name || "this person"}.

Context about this person:
- Name: ${contact.name || "Unknown"}
- Company: ${contact.company || "Unknown"}
- Role: ${contact.job_title || "Unknown"}
- How we met: ${contact.how_we_met || "Unknown"}
- Last interaction: ${contact.last_contact_date || "Unknown"}
- Next steps noted: ${contact.next_steps || "None"}
- Notes: ${contact.raw_note?.slice(0, 300) || "None"}

Requirements:
- Reference something specific from your last interaction or how you met
- Feel natural, not templated
- Include a clear reason for reaching out (not just "checking in")
- End with a soft ask (question, suggestion, or offer)
- Sign off as ${userName}
- Keep under 80 words`
    }

    // Generate with GPT-4o-mini
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You write short, warm, professional messages for networking follow-ups. Never use corporate jargon. Sound like a real person texting a professional contact. No subject lines — just the message body.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ message: "Failed to generate draft" }, { status: 500 })
    }

    const data = await response.json()
    const draft = data.choices[0].message.content.trim()

    return NextResponse.json({ draft, type })
  } catch (error) {
    console.error("Draft error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
