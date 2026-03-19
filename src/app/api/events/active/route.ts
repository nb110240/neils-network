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

    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("created_by", user.id)
      .eq("is_active", true)
      .gt("ends_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!event) {
      return NextResponse.json({ event: null })
    }

    // Get count of contacts added during this event
    const { count } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("created_by", user.id)
      .eq("event_id", event.id)

    return NextResponse.json({
      event: {
        ...event,
        contact_count: count || 0,
      },
    })
  } catch (error) {
    console.error("Error fetching active event:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
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
        { message: "Too many requests." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { error } = await supabase
      .from("events")
      .update({ is_active: false, ends_at: new Date().toISOString() })
      .eq("created_by", user.id)
      .eq("is_active", true)

    if (error) {
      console.error("Error ending event:", error)
      return NextResponse.json(
        { message: "Failed to end event" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error ending event:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
