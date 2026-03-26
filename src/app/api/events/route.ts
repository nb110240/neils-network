import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse, isValidUUID } from "@/lib/api-utils"

export async function GET() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data: events, error } = await supabase
      .from("events")
      .select("*, contacts:contacts(count)")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("Error fetching events:", error)
      return errorResponse("Failed to fetch events")
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
    return errorResponse("Internal server error")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()
    const { name, duration_hours = 4 } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return badRequestResponse("Event name is required")
    }

    if (typeof duration_hours !== "number" || duration_hours < 0.5 || duration_hours > 24) {
      return badRequestResponse("Duration must be between 0.5 and 24 hours")
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
      return errorResponse("Failed to create event")
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")

    return NextResponse.json({ event })
  } catch (error) {
    console.error("Error creating event:", error)
    return errorResponse("Internal server error")
  }
}

// PATCH: Deactivate an event
export async function PATCH(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { eventId } = await request.json()

    if (!eventId || !isValidUUID(eventId)) {
      return badRequestResponse("Valid event ID is required")
    }

    const { data: event, error } = await supabase
      .from("events")
      .update({ is_active: false })
      .eq("id", eventId)
      .eq("created_by", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error deactivating event:", error)
      return errorResponse("Failed to deactivate event")
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")

    return NextResponse.json({ event })
  } catch (error) {
    console.error("Error deactivating event:", error)
    return errorResponse("Internal server error")
  }
}
