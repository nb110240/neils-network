import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkSemanticSearchLimit, recordSemanticSearch } from "@/lib/subscription"
import { calculateHealthScore } from "@/lib/health"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Rate limit: 30 searches per minute (embedding generation is expensive)
    const rl = await rateLimit(user.id, "search")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many searches. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const body = await request.json()
    const { query, semantic = true } = body

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { message: "Query is required" },
        { status: 400 }
      )
    }

    // Check semantic search limit (free: 5/month, pro: unlimited)
    if (semantic) {
      const { allowed, used, limit, plan } = await checkSemanticSearchLimit(user.id)
      if (!allowed) {
        return NextResponse.json(
          {
            message: `You've used all ${limit} semantic searches this month. ${plan === "free" ? "Upgrade to Pro for unlimited searches." : "Limit resets next month."}`,
            used,
            limit,
          },
          { status: 403 }
        )
      }

      const openaiKey = process.env.OPENAI_API_KEY
      if (!openaiKey) {
        return NextResponse.json(
          { message: "OpenAI API key not configured" },
          { status: 500 }
        )
      }

      const embeddingResponse = await fetch(
        "https://api.openai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
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

      // Record usage after successful search
      await recordSemanticSearch(user.id)

      const resultsWithHealth = (results || []).map((r: Record<string, string>) => ({
        ...r,
        health: calculateHealthScore(r.last_contact_date, r.created_at),
      }))

      return NextResponse.json({ results: resultsWithHealth })
    } else {
      // Keyword search using ILIKE
      const sanitized = query.replace(/[%_\\,().*]/g, (c) => `\\${c}`)
      const searchPattern = `%${sanitized}%`

      const searchFields = ["name", "email", "company", "job_title", "how_we_met", "raw_note"]
      const orFilter = searchFields.map((f) => `${f}.ilike.${searchPattern}`).join(",")

      const { data: results, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("created_by", user.id)
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) {
        console.error("Keyword search error:", error)
        return NextResponse.json(
          { message: "Search failed" },
          { status: 500 }
        )
      }

      const resultsWithHealth = (results || []).map((r) => ({
        ...r,
        health: calculateHealthScore(r.last_contact_date, r.created_at),
      }))

      return NextResponse.json({ results: resultsWithHealth })
    }
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
