import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, notFoundResponse, badRequestResponse, errorResponse } from "@/lib/api-utils"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // Verify contact belongs to user
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (!contact) {
      return notFoundResponse("Contact not found")
    }

    const { data: contactTags, error } = await supabase
      .from("contact_tags")
      .select("tag_id, tags(*)")
      .eq("contact_id", id)

    if (error) {
      console.error("Error fetching contact tags:", error)
      return errorResponse("Failed to fetch tags")
    }

    const tags = (contactTags || []).map((ct: Record<string, unknown>) => ct.tags)

    return NextResponse.json({ tags })
  } catch (error) {
    console.error("Error fetching contact tags:", error)
    return errorResponse("Internal server error")
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // Verify contact belongs to user
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (!contact) {
      return notFoundResponse("Contact not found")
    }

    const body = await request.json()
    const { tagIds } = body

    if (!Array.isArray(tagIds)) {
      return badRequestResponse("tagIds must be an array")
    }

    // Remove all existing tags for this contact
    await supabase.from("contact_tags").delete().eq("contact_id", id)

    // Insert new tags
    if (tagIds.length > 0) {
      const { error } = await supabase.from("contact_tags").insert(
        tagIds.map((tagId: string) => ({
          contact_id: id,
          tag_id: tagId,
        }))
      )

      if (error) {
        console.error("Error setting contact tags:", error)
        return errorResponse("Failed to set tags")
      }
    }

    // Fetch updated tags
    const { data: contactTags } = await supabase
      .from("contact_tags")
      .select("tag_id, tags(*)")
      .eq("contact_id", id)

    const tags = (contactTags || []).map((ct: Record<string, unknown>) => ct.tags)

    return NextResponse.json({ tags })
  } catch (error) {
    console.error("Error setting contact tags:", error)
    return errorResponse("Internal server error")
  }
}
