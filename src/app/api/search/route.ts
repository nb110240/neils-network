import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, forbiddenResponse, errorResponse } from "@/lib/api-utils"
import { checkSemanticSearchLimit, recordSemanticSearch } from "@/lib/subscription"
import { calculateHealthScore } from "@/lib/health"
import { generateEmbedding } from "@/lib/openai"
import type { HealthScore } from "@/lib/types"

// ─── Reciprocal Rank Fusion ───
// Merges ranked lists from different search methods into a single ranking.
// Used by Azure AI Search, Elasticsearch, and other enterprise search engines.
const RRF_K = 60 // constant to prevent high-ranked items from dominating

interface ScoredContact {
  id: string
  [key: string]: unknown
}

function reciprocalRankFusion(
  ...rankedLists: ScoredContact[][]
): Map<string, number> {
  const scores = new Map<string, number>()

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank].id
      const rrfScore = 1 / (RRF_K + rank + 1)
      scores.set(id, (scores.get(id) || 0) + rrfScore)
    }
  }

  return scores
}

// ─── Boosting functions ───

function recencyBoost(lastContactDate: string | null, createdAt: string): number {
  const ref = lastContactDate || createdAt
  const daysSince = Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24))
  if (daysSince <= 7) return 0.15
  if (daysSince <= 30) return 0.10
  if (daysSince <= 90) return 0.05
  return 0
}

function exactMatchBoost(contact: ScoredContact, query: string): number {
  let boost = 0
  const name = ((contact.name as string) || "").toLowerCase()
  const company = ((contact.company as string) || "").toLowerCase()

  // Exact name match — strongest signal
  if (name === query) boost += 0.3
  else if (name.includes(query)) boost += 0.15

  // Company match
  if (company === query) boost += 0.2
  else if (company.includes(query)) boost += 0.1

  return boost
}

function healthBoost(health: HealthScore): number {
  // Slightly boost active relationships — they're more relevant
  if (health.level === "green") return 0.05
  return 0
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("search")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const body = await request.json()
    const {
      query: rawQuery,
      filters = {},
    } = body

    if (!rawQuery || typeof rawQuery !== "string") {
      return badRequestResponse("Query is required")
    }

    if (rawQuery.length > 2000) {
      return badRequestResponse("Query too long (max 2000 characters)")
    }

    const query = rawQuery.trim().toLowerCase()
    const { companies, tags, healthLevels } = filters as {
      companies?: string[]
      tags?: string[]
      healthLevels?: string[]
    }

    // ─── Run keyword and vector search in parallel ───

    // Keyword search
    const sanitized = query.replace(/[%_\\,().*]/g, (c) => `\\${c}`)
    const searchPattern = `%${sanitized}%`
    const searchFields = ["name", "email", "company", "job_title", "how_we_met", "next_steps", "raw_note"]
    const orFilter = searchFields.map((f) => `${f}.ilike.${searchPattern}`).join(",")

    const keywordPromise = supabase
      .from("contacts")
      .select("*")
      .eq("created_by", user.id)
      .is("archived_at", null)
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(30)

    // Vector search (if user has quota)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vectorPromise: Promise<any> | null = null
    let usedSemantic = false

    const { allowed } = await checkSemanticSearchLimit(user.id)
    if (allowed) {
      const queryEmbedding = await generateEmbedding(query)
      if (queryEmbedding) {
        usedSemantic = true
        vectorPromise = Promise.resolve(supabase.rpc("match_contacts", {
          query_embedding: queryEmbedding,
          match_threshold: 0.25,
          match_count: 30,
          user_id: user.id,
        }))
      }
    }

    // Await both in parallel
    const [keywordResult, vectorResult] = await Promise.all([
      keywordPromise,
      vectorPromise || Promise.resolve({ data: null, error: null }),
    ])

    if (keywordResult.error) {
      console.error("Keyword search error:", keywordResult.error)
    }
    if (vectorResult?.error) {
      console.error("Vector search error:", vectorResult.error)
    }

    const keywordResults = (keywordResult.data || []) as ScoredContact[]
    const vectorResults = ((vectorResult?.data) || []) as ScoredContact[]

    // Record semantic usage if we used it
    if (usedSemantic) {
      await recordSemanticSearch(user.id)
    }

    // ─── Merge with Reciprocal Rank Fusion ───

    const rrfScores = reciprocalRankFusion(keywordResults, vectorResults)

    // Build contact map (prefer vector result data as it has similarity)
    const contactMap = new Map<string, ScoredContact>()
    for (const c of keywordResults) contactMap.set(c.id, c)
    for (const c of vectorResults) contactMap.set(c.id, c) // vector overwrites — has similarity

    // ─── Apply boosting ───

    const boostedResults = Array.from(rrfScores.entries()).map(([id, rrfScore]) => {
      const contact = contactMap.get(id)!
      const health = calculateHealthScore(
        contact.last_contact_date as string | null,
        contact.created_at as string
      )

      const finalScore =
        rrfScore +
        recencyBoost(contact.last_contact_date as string | null, contact.created_at as string) +
        exactMatchBoost(contact, query) +
        healthBoost(health)

      return {
        ...contact,
        health,
        _score: Math.round(finalScore * 1000) / 1000,
        similarity: (contact.similarity as number) ?? undefined,
        matchPercent: 0,
      }
    })

    // Sort by final score descending
    boostedResults.sort((a, b) => b._score - a._score)

    // Normalize scores to 0-100% match for display
    // Top result = 99%, others scaled relative to it
    const maxScore = boostedResults[0]?._score || 1
    for (const r of boostedResults) {
      r.matchPercent = Math.min(99, Math.max(1, Math.round((r._score / maxScore) * 99)))
    }

    // ─── Apply facet filters ───

    let filtered = boostedResults

    if (companies && companies.length > 0) {
      const companySet = new Set(companies.map((c: string) => c.toLowerCase()))
      filtered = filtered.filter((c) => {
        const company = (c as Record<string, unknown>).company as string | null
        return company && companySet.has(company.toLowerCase())
      })
    }

    if (healthLevels && healthLevels.length > 0) {
      const levelSet = new Set(healthLevels)
      filtered = filtered.filter((c) => levelSet.has(c.health.level))
    }

    // Tag filtering requires a separate query
    if (tags && tags.length > 0) {
      const contactIds = filtered.map((c) => c.id)
      if (contactIds.length > 0) {
        const { data: contactTags } = await supabase
          .from("contact_tags")
          .select("contact_id")
          .in("contact_id", contactIds)
          .in("tag_id", tags)

        if (contactTags) {
          const matchingIds = new Set(contactTags.map((ct) => ct.contact_id))
          filtered = filtered.filter((c) => matchingIds.has(c.id))
        }
      }
    }

    // Limit to top 20
    const finalResults = filtered.slice(0, 20)

    // ─── Build facets from unfiltered results for the UI ───

    const companyFacets: Record<string, number> = {}
    const healthFacets: Record<string, number> = {}

    for (const r of boostedResults) {
      const company = (r as Record<string, unknown>).company as string | null
      if (company) {
        companyFacets[company] = (companyFacets[company] || 0) + 1
      }
      healthFacets[r.health.level] = (healthFacets[r.health.level] || 0) + 1
    }

    return NextResponse.json({
      results: finalResults,
      totalMatches: boostedResults.length,
      searchMode: usedSemantic ? "hybrid" : "keyword",
      facets: {
        companies: Object.entries(companyFacets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count })),
        health: Object.entries(healthFacets)
          .sort((a, b) => b[1] - a[1])
          .map(([level, count]) => ({ level, count })),
      },
    })
  } catch (error) {
    console.error("Search error:", error)
    return errorResponse("Internal server error")
  }
}
