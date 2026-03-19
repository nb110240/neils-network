import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { supabase } = auth

    const { searchParams } = new URL(request.url)
    const contactIdsParam = searchParams.get("contactIds")

    if (!contactIdsParam) {
      return badRequestResponse("contactIds query parameter is required")
    }

    const contactIds = contactIdsParam.split(",").filter(Boolean)
    if (contactIds.length === 0) {
      return NextResponse.json({ contactTags: [] })
    }

    const { data: contactTags, error } = await supabase
      .from("contact_tags")
      .select("contact_id, tag_id")
      .in("contact_id", contactIds)

    if (error) {
      console.error("Error fetching contact tags:", error)
      return errorResponse("Failed to fetch contact tags")
    }

    return NextResponse.json({ contactTags: contactTags || [] })
  } catch (error) {
    console.error("Error fetching contact tags:", error)
    return errorResponse("Internal server error")
  }
}
