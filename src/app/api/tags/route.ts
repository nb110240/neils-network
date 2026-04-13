import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"
import { parseBody } from "@/lib/request"
import { z } from "zod/v4"

const CreateTagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(50, "Tag name too long (max 50 characters)").transform(v => v.trim()),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").optional(),
})

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

    const result = await parseBody(request, CreateTagSchema, { route: "/api/tags", userId: user.id })
    if (result.error) return result.error
    const { name, color } = result.data

    const { data: tag, error } = await supabase
      .from("tags")
      .insert({
        name,
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
