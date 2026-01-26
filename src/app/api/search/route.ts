import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { query, semantic = true } = body

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { message: "Query is required" },
        { status: 400 }
      )
    }

    if (semantic) {
      // Semantic search using embeddings
      const openaiKey = process.env.OPENAI_API_KEY
      if (!openaiKey) {
        return NextResponse.json(
          { message: "OpenAI API key not configured" },
          { status: 500 }
        )
      }

      // Generate embedding for the query
      const embeddingResponse = await fetch(
        "https://api.openai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-ada-002",
            input: query,
          }),
        }
      )

      if (!embeddingResponse.ok) {
        console.error("Failed to generate embedding")
        return NextResponse.json(
          { message: "Failed to generate embedding" },
          { status: 500 }
        )
      }

      const embeddingData = await embeddingResponse.json()
      const queryEmbedding = embeddingData.data[0].embedding

      // Call the match_contacts function
      const { data: results, error } = await supabase.rpc("match_contacts", {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 20,
        user_id: user.id,
      })

      if (error) {
        console.error("Semantic search error:", error)
        return NextResponse.json(
          { message: "Search failed" },
          { status: 500 }
        )
      }

      return NextResponse.json({ results: results || [] })
    } else {
      // Keyword search using ILIKE
      const searchPattern = `%${query}%`

      const { data: results, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("created_by", user.id)
        .or(
          `name.ilike.${searchPattern},email.ilike.${searchPattern},company.ilike.${searchPattern},job_title.ilike.${searchPattern},how_we_met.ilike.${searchPattern},raw_note.ilike.${searchPattern}`
        )
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) {
        console.error("Keyword search error:", error)
        return NextResponse.json(
          { message: "Search failed" },
          { status: 500 }
        )
      }

      return NextResponse.json({ results: results || [] })
    }
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
