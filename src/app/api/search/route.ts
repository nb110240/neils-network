import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, forbiddenResponse, errorResponse } from "@/lib/api-utils"
import { checkSemanticSearchLimit, recordSemanticSearch } from "@/lib/subscription"
import { calculateHealthScore } from "@/lib/health"
import { generateEmbedding } from "@/lib/openai"

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("search")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()
    const { query, semantic = true } = body

    if (!query || typeof query !== "string") {
      return badRequestResponse("Query is required")
    }

    if (query.length > 2000) {
      return badRequestResponse("Query too long (max 2000 characters)")
    }

    // Check semantic search limit (free: 5/month, pro: unlimited)
    if (semantic) {
      const { allowed, used, limit, plan } = await checkSemanticSearchLimit(user.id)
      if (!allowed) {
        return forbiddenResponse(
          `You've used all ${limit} semantic searches this month. ${plan === "free" ? "Upgrade to Pro for unlimited searches." : "Limit resets next month."}`
        )
      }

      const queryEmbedding = await generateEmbedding(query)
      if (!queryEmbedding) {
        return errorResponse("Failed to generate embedding")
      }

      const { data: results, error } = await supabase.rpc("match_contacts", {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 20,
        user_id: user.id,
      })

      if (error) {
        console.error("Semantic search error:", error)
        return errorResponse("Search failed")
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
        return errorResponse("Search failed")
      }

      const resultsWithHealth = (results || []).map((r) => ({
        ...r,
        health: calculateHealthScore(r.last_contact_date, r.created_at),
      }))

      return NextResponse.json({ results: resultsWithHealth })
    }
  } catch (error) {
    console.error("Search error:", error)
    return errorResponse("Internal server error")
  }
}
