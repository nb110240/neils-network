import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"

// Manual sync: user triggers from dashboard
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const result = await syncCalendarForUser(user.id, user.email || "")
    return NextResponse.json(result)
  } catch (error) {
    console.error("Calendar sync error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

// Cron sync: called from Vercel cron every 6 hours
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = await createServiceClient()

    const { data: integrations } = await supabase
      .from("integrations")
      .select("user_id")
      .eq("provider", "google_calendar")

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ message: "No calendar integrations", synced: 0 })
    }

    let synced = 0
    for (const { user_id } of integrations) {
      const { data: { user } } = await supabase.auth.admin.getUserById(user_id)
      if (!user?.email) continue

      try {
        await syncCalendarForUser(user_id, user.email)
        synced++
      } catch (err) {
        console.error(`Calendar sync failed for user ${user_id}:`, err)
      }
    }

    return NextResponse.json({ success: true, synced })
  } catch (error) {
    console.error("Calendar cron error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
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
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("email")
    .eq("created_by", userId)
    .not("email", "is", null)

  const existingEmails = new Set(
    (existingContacts || []).map((c) => c.email?.toLowerCase())
  )

  let newContacts = 0
  const userEmailLower = userEmail.toLowerCase()

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

    // Skip if we already have this contact
    if (existingEmails.has(otherEmail)) {
      // Update last_contact_date if this meeting is more recent
      const eventDate = event.start?.dateTime?.split("T")[0] || event.start?.date
      if (eventDate) {
        await supabase
          .from("contacts")
          .update({ last_contact_date: eventDate })
          .eq("created_by", userId)
          .ilike("email", otherEmail)
          .lt("last_contact_date", eventDate)
      }
      continue
    }

    // Create new contact from 1:1 meeting
    const name = otherPerson.displayName || otherEmail.split("@")[0]
    const eventDate = event.start?.dateTime?.split("T")[0] || event.start?.date
    const eventSummary = event.summary || "Calendar meeting"

    const { error } = await supabase.from("contacts").insert({
      name,
      email: otherPerson.email,
      raw_note: `Met via calendar: "${eventSummary}" on ${eventDate}`,
      how_we_met: `1:1 meeting: ${eventSummary}`,
      last_contact_date: eventDate,
      source: "google_calendar",
      created_by: userId,
      follow_up_needed: false,
    })

    if (!error) {
      existingEmails.add(otherEmail)
      newContacts++
    }
  }

  // Update last sync time
  await supabase
    .from("integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", integration.id)

  return { success: true, newContacts, eventsProcessed: events.length }
}
