import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authenticateRequest, authFailed, notFoundResponse, errorResponse, isValidUUID, badRequestResponse } from "@/lib/api-utils"
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/openai"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!isValidUUID(id)) {
      return badRequestResponse("Invalid contact ID")
    }

    const auth = await authenticateRequest("create")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // Verify contact belongs to user
    const { data: contact, error } = await supabase
      .from("contacts")
      .select("id, name, company, job_title, email, how_we_met, next_steps, raw_note, created_by")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (error || !contact) {
      return notFoundResponse("Contact not found")
    }

    // Build embedding text and generate embedding
    const embeddingText = buildContactEmbeddingText({
      name: contact.name,
      company: contact.company,
      job_title: contact.job_title,
      email: contact.email,
      how_we_met: contact.how_we_met,
      next_steps: contact.next_steps,
      raw_note: contact.raw_note,
    })
    const embedding = await generateEmbedding(embeddingText)

    const embeddingStatus = embedding ? "complete" : "failed"

    const updateData: Record<string, unknown> = { embedding_status: embeddingStatus }
    if (embedding) {
      updateData.embedding = embedding
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", id)
      .eq("created_by", user.id)

    if (updateError) {
      return errorResponse("Failed to update contact embedding")
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")

    return NextResponse.json({ success: true, status: embeddingStatus })
  } catch (error) {
    console.error("Error retrying embedding:", error)
    return errorResponse("Internal server error")
  }
}
