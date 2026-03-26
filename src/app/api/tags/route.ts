import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"

export async function GET() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data: tags, error } = await supabase
      .from("tags")
      .select("*")
      .eq("created_by", user.id)
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching tags:", error)
      return errorResponse("Failed to fetch tags")
    }

    return NextResponse.json({ tags: tags || [] })
  } catch (error) {
    console.error("Error fetching tags:", error)
    return errorResponse("Internal server error")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()
    const { name, color } = body

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 50) {
      return badRequestResponse("Tag name must be 1-50 characters")
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
          { error: "A tag with this name already exists" },
          { status: 409 }
        )
      }
      console.error("Error creating tag:", error)
      return errorResponse("Failed to create tag")
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")

    return NextResponse.json({ tag })
  } catch (error) {
    console.error("Error creating tag:", error)
    return errorResponse("Internal server error")
  }
}
