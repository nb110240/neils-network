import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function GET() {
  try {
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

    const { data: tags, error } = await supabase
      .from("tags")
      .select("*")
      .eq("created_by", user.id)
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching tags:", error)
      return NextResponse.json(
        { message: "Failed to fetch tags" },
        { status: 500 }
      )
    }

    return NextResponse.json({ tags: tags || [] })
  } catch (error) {
    console.error("Error fetching tags:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const { name, color } = body

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 50) {
      return NextResponse.json(
        { message: "Tag name must be 1-50 characters" },
        { status: 400 }
      )
    }

    const { data: tag, error } = await supabase
      .from("tags")
      .insert({
        name: name.trim(),
        color: color || "#78716c",
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { message: "A tag with this name already exists" },
          { status: 409 }
        )
      }
      console.error("Error creating tag:", error)
      return NextResponse.json(
        { message: "Failed to create tag" },
        { status: 500 }
      )
    }

    return NextResponse.json({ tag })
  } catch (error) {
    console.error("Error creating tag:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
