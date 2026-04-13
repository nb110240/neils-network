import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/api-utils"
import { computeNextDueDate } from "@/lib/health"
import { z } from "zod/v4"

const VALID_TYPES = ["meeting", "note", "call", "email", "message", "other"] as const

const CreateActivitySchema = z.object({
  type: z.enum(VALID_TYPES),
  content: z.string().min(1, "Content is required").max(10000),
  occurred_at: z.string(),
  follow_up_needed: z.boolean().optional().default(false),
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── GET: List activities for a contact ───

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return badRequestResponse("Invalid contact ID")
    }

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (contactError || !contact) {
      return notFoundResponse("Contact not found")
    }

    const { data: activities, error } = await supabase
      .from("contact_activities")
      .select("*")
      .eq("contact_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Error fetching activities:", error)
      return errorResponse("Failed to fetch activities")
    }

    return NextResponse.json({ activities: activities ?? [] })
  } catch (error) {
    console.error("Error fetching activities:", error)
    return errorResponse("Internal server error")
  }
}

// ─── POST: Create a new activity ───

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return badRequestResponse("Invalid contact ID")
    }

    const auth = await authenticateRequest("create")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, last_contact_date, cadence_days, scheduled_follow_up, created_at")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (contactError || !contact) {
      return notFoundResponse("Contact not found")
    }

    const body = await request.json()
    const parsed = CreateActivitySchema.safeParse(body)
    if (!parsed.success) {
      return badRequestResponse(parsed.error.issues[0]?.message ?? "Invalid input")
    }

    const { type, content, occurred_at, follow_up_needed } = parsed.data

    // Insert the activity
    const { data: activity, error: insertError } = await supabase
      .from("contact_activities")
      .insert({
        contact_id: id,
        user_id: user.id,
        type,
        content,
        occurred_at,
        follow_up_needed,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating activity:", insertError)
      return errorResponse("Failed to create activity")
    }

    // Update contact's last_contact_date if this activity is more recent
    const activityDate = new Date(occurred_at)
    const currentLastContact = contact.last_contact_date
      ? new Date(contact.last_contact_date)
      : null

    const updateData: Record<string, unknown> = {
      follow_up_needed,
    }

    if (!currentLastContact || activityDate > currentLastContact) {
      updateData.last_contact_date = occurred_at
    }

    // Clear scheduled follow-up if it's today or past (the user just interacted)
    if (contact.scheduled_follow_up) {
      const followUpDate = new Date(contact.scheduled_follow_up)
      const today = new Date(new Date().toISOString().split("T")[0])
      if (followUpDate <= today) {
        updateData.scheduled_follow_up = null
      }
    }

    // Clear snooze (user interacted, snooze is moot)
    updateData.snoozed_until = null

    // Recompute next_due_date with the new last_contact_date
    const newLastContact = updateData.last_contact_date as string || contact.last_contact_date
    const newScheduledFollowUp = (updateData.scheduled_follow_up !== undefined
      ? updateData.scheduled_follow_up
      : contact.scheduled_follow_up) as string | null
    updateData.next_due_date = computeNextDueDate(
      newLastContact,
      contact.created_at,
      contact.cadence_days,
      newScheduledFollowUp
    )

    await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", id)
      .eq("created_by", user.id)

    // Revalidate dashboard and reach-out so health scores update immediately
    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")

    return NextResponse.json({ activity }, { status: 201 })
  } catch (error) {
    console.error("Error creating activity:", error)
    return errorResponse("Internal server error")
  }
}

// ─── DELETE: Delete an activity ───

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return badRequestResponse("Invalid contact ID")
    }

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (contactError || !contact) {
      return notFoundResponse("Contact not found")
    }

    const url = new URL(request.url)
    const activityId = url.searchParams.get("activityId")

    if (!activityId || !UUID_RE.test(activityId)) {
      return badRequestResponse("Invalid activity ID")
    }

    // Delete the activity (RLS ensures user owns it)
    const { error } = await supabase
      .from("contact_activities")
      .delete()
      .eq("id", activityId)
      .eq("user_id", user.id)
      .eq("contact_id", id)

    if (error) {
      console.error("Error deleting activity:", error)
      return errorResponse("Failed to delete activity")
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting activity:", error)
    return errorResponse("Internal server error")
  }
}
