import { NextResponse, type NextRequest } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { verifyDevAccess } from "@/lib/api-utils"
import { buildContactEmbeddingText } from "@/lib/openai"

export async function POST(request: NextRequest) {
  try {
    const devError = await verifyDevAccess(request)
    if (devError) return devError

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const serviceSupabase = await createServiceClient()

    const { data: contacts } = await serviceSupabase
      .from("contacts")
      .select("id, name, company, job_title, email, how_we_met, next_steps, raw_note")
      .eq("created_by", user.id)
      .is("archived_at", null)

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ message: "No contacts to embed", count: 0 })
    }

    // Fire and forget — re-embed in background. Errors run after the response,
    // so they must go to Sentry explicitly.
    reEmbedBatch(contacts, serviceSupabase).catch((err) => {
      console.error("Re-embed background batch failed:", err)
      Sentry.captureException(err, { tags: { background: "dev-re-embed" } })
    })

    return NextResponse.json({ success: true, count: contacts.length })
  } catch (error) {
    console.error("Re-embed error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

async function reEmbedBatch(
  contacts: { id: string; name: string | null; company: string | null; job_title: string | null; email: string | null; how_we_met: string | null; next_steps: string | null; raw_note: string }[],
  supabase: Awaited<ReturnType<typeof createServiceClient>>
) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return

  const batchSize = 50
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize)
    const texts = batch.map((c) => buildContactEmbeddingText(c))

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
    })

    if (!res.ok) continue

    const data = await res.json()
    const embeddings = data.data as { embedding: number[]; index: number }[]

    for (const item of embeddings) {
      await supabase
        .from("contacts")
        .update({ embedding: item.embedding })
        .eq("id", batch[item.index].id)
    }
  }
}
