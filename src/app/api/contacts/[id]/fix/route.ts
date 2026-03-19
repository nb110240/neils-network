import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, notFoundResponse, errorResponse, isValidUUID, badRequestResponse } from "@/lib/api-utils"
import { extractContactInfo } from "@/lib/extract-contact"
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

    const { data: contact, error } = await supabase
      .from("contacts")
      .select("id, raw_note, created_by")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (error || !contact) {
      return notFoundResponse("Contact not found")
    }

    const extracted = await extractContactInfo(contact.raw_note)

    // Re-generate embedding with extracted fields
    const embeddingText = buildContactEmbeddingText({
      name: extracted.name as string | null,
      company: extracted.company as string | null,
      job_title: extracted.job_title as string | null,
      raw_note: contact.raw_note,
    })
    const embedding = await generateEmbedding(embeddingText)

    const embeddingStatus = embedding ? "complete" : "failed"
    const updateData = embedding
      ? { ...extracted, embedding, embedding_status: embeddingStatus }
      : { ...extracted, embedding_status: embeddingStatus }

    const { data: fixed, error: updateError } = await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", id)
      .eq("created_by", user.id)
      .select()
      .single()

    if (updateError) {
      return errorResponse("Failed to update contact")
    }

    return NextResponse.json({ contact: fixed })
  } catch (error) {
    console.error("Error fixing contact:", error)
    return errorResponse("Internal server error")
  }
}
