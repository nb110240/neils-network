import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/api-utils"
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
      .select("id, last_contact_date")
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
