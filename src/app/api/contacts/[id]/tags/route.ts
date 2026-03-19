import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Verify contact belongs to user
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ message: "Contact not found" }, { status: 404 })
    }

    const { data: contactTags, error } = await supabase
      .from("contact_tags")
      .select("tag_id, tags(*)")
      .eq("contact_id", id)

    if (error) {
      console.error("Error fetching contact tags:", error)
      return NextResponse.json(
        { message: "Failed to fetch tags" },
        { status: 500 }
      )
    }

    const tags = (contactTags || []).map((ct: Record<string, unknown>) => ct.tags)

    return NextResponse.json({ tags })
  } catch (error) {
    console.error("Error fetching contact tags:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Verify contact belongs to user
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ message: "Contact not found" }, { status: 404 })
    }

    const body = await request.json()
    const { tagIds } = body

    if (!Array.isArray(tagIds)) {
      return NextResponse.json(
        { message: "tagIds must be an array" },
        { status: 400 }
      )
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
        return NextResponse.json(
          { message: "Failed to set tags" },
          { status: 500 }
        )
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
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
