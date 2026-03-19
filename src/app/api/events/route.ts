import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const rl = await rateLimit(user.id, "general")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { data: events, error } = await supabase
      .from("events")
      .select("*, contacts:contacts(count)")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching events:", error)
      return NextResponse.json(
        { message: "Failed to fetch events" },
        { status: 500 }
      )
    }

    const eventsWithCount = (events || []).map((e: Record<string, unknown>) => ({
      ...e,
      contact_count: Array.isArray(e.contacts) && e.contacts.length > 0
        ? (e.contacts[0] as Record<string, number>).count
        : 0,
    }))

    return NextResponse.json({ events: eventsWithCount })
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const rl = await rateLimit(user.id, "general")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const body = await request.json()
    const { name, duration_hours = 4 } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { message: "Event name is required" },
        { status: 400 }
      )
    }

    if (typeof duration_hours !== "number" || duration_hours < 0.5 || duration_hours > 24) {
      return NextResponse.json(
        { message: "Duration must be between 0.5 and 24 hours" },
        { status: 400 }
      )
    }

    // Deactivate any currently active events
    await supabase
      .from("events")
      .update({ is_active: false })
      .eq("created_by", user.id)
      .eq("is_active", true)

    const now = new Date()
    const endsAt = new Date(now.getTime() + duration_hours * 60 * 60 * 1000)

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        name: name.trim(),
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        created_by: user.id,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating event:", error)
      return NextResponse.json(
        { message: "Failed to create event" },
        { status: 500 }
      )
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
