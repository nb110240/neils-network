import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"
import { z } from "zod/v4"

const SnoozeSchema = z.object({
  days: z.number().int().min(1).max(90).optional(),
  until: z.string().optional(),
}).refine((d) => d.days || d.until, { message: "Provide days or until" })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
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

    const body = await request.json()
    const parsed = SnoozeSchema.safeParse(body)
    if (!parsed.success) {
      return badRequestResponse(parsed.error.issues[0]?.message ?? "Invalid input")
    }

    let snoozedUntil: string
    if (parsed.data.until) {
      snoozedUntil = parsed.data.until
    } else {
      const date = new Date()
      date.setDate(date.getDate() + (parsed.data.days || 3))
      snoozedUntil = date.toISOString().split("T")[0]
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .update({ snoozed_until: snoozedUntil })
      .eq("id", id)
      .eq("created_by", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error snoozing contact:", error)
      return errorResponse("Failed to snooze contact")
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/moves")
    revalidatePath("/contacts")

    return NextResponse.json({ contact, snoozed_until: snoozedUntil })
  } catch (error) {
    console.error("Error snoozing contact:", error)
    return errorResponse("Internal server error")
  }
}

// DELETE to unsnooze
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

    const { data: contact, error } = await supabase
      .from("contacts")
      .update({ snoozed_until: null })
      .eq("id", id)
      .eq("created_by", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error unsnoozing contact:", error)
      return errorResponse("Failed to unsnooze contact")
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/moves")
    revalidatePath("/contacts")

    return NextResponse.json({ contact })
  } catch (error) {
    console.error("Error unsnoozing contact:", error)
    return errorResponse("Internal server error")
  }
}
