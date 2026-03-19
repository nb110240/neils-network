import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"

export async function GET() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

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
    return errorResponse("Internal server error")
  }
}

export async function DELETE() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { error } = await supabase
      .from("events")
      .update({ is_active: false, ends_at: new Date().toISOString() })
      .eq("created_by", user.id)
      .eq("is_active", true)

    if (error) {
      console.error("Error ending event:", error)
      return errorResponse("Failed to end event")
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error ending event:", error)
    return errorResponse("Internal server error")
  }
}
