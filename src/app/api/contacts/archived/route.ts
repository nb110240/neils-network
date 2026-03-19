import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"

export async function GET() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("created_by", user.id)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })

    if (error) {
      console.error("Error fetching archived contacts:", error)
      return errorResponse("Failed to fetch archived contacts")
    }

    return NextResponse.json({ contacts: contacts || [] })
  } catch (error) {
    console.error("Error fetching archived contacts:", error)
    return errorResponse("Internal server error")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()
    const { contactId } = body

    if (!contactId || typeof contactId !== "string") {
      return badRequestResponse("Missing contactId")
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .update({ archived_at: null })
      .eq("id", contactId)
      .eq("created_by", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error restoring contact:", error)
      return errorResponse("Failed to restore contact")
    }

    return NextResponse.json({ success: true, contact })
  } catch (error) {
    console.error("Error restoring contact:", error)
    return errorResponse("Internal server error")
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()
    const { contactId } = body

    if (!contactId || typeof contactId !== "string") {
      return badRequestResponse("Missing contactId")
    }

    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contactId)
      .eq("created_by", user.id)

    if (error) {
      console.error("Error permanently deleting contact:", error)
      return errorResponse("Failed to permanently delete contact")
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error permanently deleting contact:", error)
    return errorResponse("Internal server error")
  }
}
