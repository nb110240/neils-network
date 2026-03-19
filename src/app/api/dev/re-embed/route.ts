import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/admin"

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const serviceSupabase = await createServiceClient()

    const { data: contacts } = await serviceSupabase
      .from("contacts")
      .select("id, name, company, raw_note")
      .eq("created_by", user.id)

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ message: "No contacts to embed", count: 0 })
    }

    // Fire and forget — re-embed in background
    reEmbedBatch(contacts, serviceSupabase).catch(console.error)

    return NextResponse.json({ success: true, count: contacts.length })
  } catch (error) {
    console.error("Re-embed error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

async function reEmbedBatch(
  contacts: { id: string; name: string | null; company: string | null; raw_note: string }[],
  supabase: Awaited<ReturnType<typeof createServiceClient>>
) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return

  const batchSize = 50
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize)
    const texts = batch.map(
      (c) => `${c.name || ""} ${c.company || ""} ${c.raw_note}`
    )

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
