import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authenticateRequest, authFailed, badRequestResponse, notFoundResponse, errorResponse } from "@/lib/api-utils"
import { calculateHealthScore } from "@/lib/health"
import { z } from "zod/v4"

// Transform empty strings to null so Zod validators (like .email()) don't reject them
// Also accept null directly (for clearing fields)
const emptyToNull = z.union([
  z.null(),
  z.string().transform((v) => (v.trim() === "" ? null : v)),
])

const UpdateContactSchema = z.object({
  name: emptyToNull.pipe(z.string().max(255).nullable()).optional(),
  email: emptyToNull.pipe(z.string().email().max(320).nullable()).optional(),
  phone: emptyToNull.pipe(z.string().max(50).nullable()).optional(),
  company: emptyToNull.pipe(z.string().max(255).nullable()).optional(),
  job_title: emptyToNull.pipe(z.string().max(255).nullable()).optional(),
  website: emptyToNull.pipe(z.string().max(500).nullable()).optional(),
  how_we_met: emptyToNull.pipe(z.string().max(5000).nullable()).optional(),
  next_steps: emptyToNull.pipe(z.string().max(5000).nullable()).optional(),
  follow_up_needed: z.boolean().optional(),
  last_contact_date: emptyToNull.pipe(z.string().nullable()).optional(),
  raw_note: emptyToNull.pipe(z.string().max(10000).nullable()).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return badRequestResponse("Invalid contact ID")
    }

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data: contact, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (error || !contact) {
      return notFoundResponse("Contact not found")
    }

    return NextResponse.json({
      contact: {
        ...contact,
        health: calculateHealthScore(contact.last_contact_date, contact.created_at),
      },
    })
  } catch (error) {
    console.error("Error fetching contact:", error)
    return errorResponse("Internal server error")
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return badRequestResponse("Invalid contact ID")
    }

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()

    const parsed = UpdateContactSchema.safeParse(body)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      const field = firstIssue?.path?.join(".") || "input"
      return badRequestResponse(`Invalid ${field}: ${firstIssue?.message || "check your input"}`)
    }

    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", id)
      .eq("created_by", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating contact:", error)
      return errorResponse("Failed to update contact")
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")
    return NextResponse.json({ contact })
  } catch (error) {
    console.error("Error updating contact:", error)
    return errorResponse("Internal server error")
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return badRequestResponse("Invalid contact ID")
    }

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // Soft delete: set archived_at instead of hard delete
    const { error } = await supabase
      .from("contacts")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("created_by", user.id)

    if (error) {
      console.error("Error archiving contact:", error)
      return errorResponse("Failed to archive contact")
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting contact:", error)
    return errorResponse("Internal server error")
  }
}
