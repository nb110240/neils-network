import { calculateHealthScore } from "@/lib/health"
import type { HealthScore } from "@/lib/types"

// ─── Reciprocal Rank Fusion ───
// Merges ranked lists from different search methods into a single ranking.
// Used by Azure AI Search, Elasticsearch, and other enterprise search engines.
const RRF_K = 60 // constant to prevent high-ranked items from dominating

export interface ScoredContact {
  id: string
  [key: string]: unknown
}

export function reciprocalRankFusion(
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

export function recencyBoost(lastContactDate: string | null, createdAt: string): number {
  const ref = lastContactDate || createdAt
  const daysSince = Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24))
  if (daysSince <= 7) return 0.15
  if (daysSince <= 30) return 0.10
  if (daysSince <= 90) return 0.05
  return 0
}

export function exactMatchBoost(contact: ScoredContact, query: string): number {
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

export function healthBoost(health: HealthScore): number {
  // Slightly boost active relationships — they're more relevant
  if (health.level === "green") return 0.05
  return 0
}
