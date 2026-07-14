import { NextResponse, after } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { parseBody } from "@/lib/request"
import { z } from "zod/v4"
import { checkSemanticSearchLimit, recordSemanticSearch } from "@/lib/subscription"
import { calculateHealthScore } from "@/lib/health"
import { CONTACT_COLUMNS } from "@/lib/contact-columns"
import { generateEmbedding } from "@/lib/openai"
import { reciprocalRankFusion, recencyBoost, exactMatchBoost, healthBoost, type ScoredContact } from "@/lib/search-utils"
import type { HealthScore } from "@/lib/types"

const SearchSchema = z.object({
  query: z.string().min(1, "Query is required").max(2000, "Query too long (max 2000 characters)"),
  filters: z.object({
    companies: z.array(z.string().max(255)).max(50).optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    healthLevels: z.array(z.string().max(20)).max(10).optional(),
  }).optional().default({}),
})

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("search")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const result = await parseBody(request, SearchSchema, { route: "/api/search", userId: user.id })
    if (result.error) return result.error
    const { query: rawQuery, filters } = result.data

    const query = rawQuery.trim().toLowerCase()
    const { companies, tags, healthLevels } = filters

    // ─── Run keyword and vector search in parallel ───

    // Keyword search
    const sanitized = query.replace(/[%_\\,().*]/g, (c) => `\\${c}`)
    const searchPattern = `%${sanitized}%`
    const searchFields = ["name", "email", "company", "job_title", "how_we_met", "next_steps", "raw_note"]
    const orFilter = searchFields.map((f) => `${f}.ilike.${searchPattern}`).join(",")

    // Fired immediately (the trailing .then() starts execution now) so the
    // keyword query runs concurrently with the semantic-limit check + OpenAI
    // embedding below. CONTACT_COLUMNS = the Contact shape minus the large
    // `embedding` vector, which results never display.
    const keywordPromise = supabase
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("created_by", user.id)
      .is("archived_at", null)
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(30)
      .then((r) => r)

    // Vector pipeline (limit check -> embedding -> match RPC) as one async unit,
    // run in parallel with the keyword query so the ~300-800ms embedding latency
    // overlaps the keyword round-trip instead of stacking before it.
    const vectorPromise = (async () => {
      const { allowed } = await checkSemanticSearchLimit(user.id)
      if (!allowed) return { data: null, error: null, usedSemantic: false }
      const queryEmbedding = await generateEmbedding(query)
      if (!queryEmbedding) return { data: null, error: null, usedSemantic: false }
      const res = await supabase.rpc("match_contacts", {
        query_embedding: queryEmbedding,
        match_threshold: 0.25,
        match_count: 30,
        user_id: user.id,
      })
      return { data: res.data, error: res.error, usedSemantic: true }
    })()

    const [keywordResult, vectorResult] = await Promise.all([keywordPromise, vectorPromise])
    const usedSemantic = vectorResult.usedSemantic

    if (keywordResult.error) {
      console.error("Keyword search error:", keywordResult.error)
    }
    if (vectorResult.error) {
      console.error("Vector search error:", vectorResult.error)
    }

    const keywordResults = (keywordResult.data || []) as ScoredContact[]
    const vectorResults = (vectorResult.data || []) as ScoredContact[]

    // Record semantic usage without blocking the response. after() needs a
    // request scope (always present for a real request); fall back to a
    // fire-and-forget call where it isn't (e.g. a unit test invoking the
    // handler directly), so the route never 500s on the recording step.
    if (usedSemantic) {
      try {
        after(() => recordSemanticSearch(user.id))
      } catch {
        void recordSemanticSearch(user.id)
      }
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
