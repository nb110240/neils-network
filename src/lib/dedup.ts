import type { SupabaseClient } from "@supabase/supabase-js"
import type { Contact } from "@/lib/types"

export interface DuplicateMatch {
  contact: Contact
  score: number
  reason: string
}

export interface PairScore {
  score: number
  reason: string
}

export type ConfidenceTier = "high" | "medium" | "low"

export function tierForScore(score: number): ConfidenceTier {
  if (score >= 0.9) return "high"
  if (score >= 0.7) return "medium"
  return "low"
}

export type ScorableFields = {
  name?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  website?: string | null
  embedding?: number[] | null
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

function fuzzyName(name: string | null | undefined): string {
  if (!name) return ""
  return name.toLowerCase().replace(/[^a-z]/g, "")
}

function extractLinkedInSlug(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/(?:\/\/|\.)(www\.)?linkedin\.com\/in\/([\w-]+)/i)
  return match ? match[2].toLowerCase() : null
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

function nameTokens(name: string | null | undefined): Set<string> {
  if (!name) return new Set()
  return new Set(
    name
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3)
  )
}

/**
 * Score how likely two sets of contact fields represent the same person.
 * Returns null if no signal is strong enough to flag as a duplicate candidate.
 * Single source of truth used by both on-create dedup and scan clustering.
 */
export function scorePair(a: ScorableFields, b: ScorableFields): PairScore | null {
  const emailA = a.email?.trim().toLowerCase() || null
  const emailB = b.email?.trim().toLowerCase() || null
  if (emailA && emailB && emailA === emailB) {
    return { score: 1.0, reason: "Same email" }
  }

  const slugA = extractLinkedInSlug(a.website ?? null)
  const slugB = extractLinkedInSlug(b.website ?? null)
  if (slugA && slugB && slugA === slugB) {
    return { score: 1.0, reason: "Same LinkedIn profile" }
  }

  const phoneA = a.phone ? normalizePhone(a.phone) : ""
  const phoneB = b.phone ? normalizePhone(b.phone) : ""
  if (phoneA && phoneA === phoneB) {
    return { score: 0.9, reason: "Same phone number" }
  }

  const nameA = a.name ? normalizeName(a.name) : ""
  const nameB = b.name ? normalizeName(b.name) : ""
  const companyA = a.company?.trim().toLowerCase() || ""
  const companyB = b.company?.trim().toLowerCase() || ""
  if (nameA && nameA === nameB && companyA && companyA === companyB) {
    return { score: 0.85, reason: "Same name and company" }
  }

  if (nameA && nameA === nameB) {
    return { score: 0.75, reason: "Same name" }
  }

  const fuzzyA = fuzzyName(a.name)
  const fuzzyB = fuzzyName(b.name)
  if (fuzzyA.length >= 3 && fuzzyA === fuzzyB) {
    return { score: 0.7, reason: "Similar name" }
  }

  if (emailA && fuzzyB.length >= 3) {
    const prefix = emailA.split("@")[0].replace(/[^a-z0-9]/g, "")
    if (prefix.length >= 3 && prefix === fuzzyB) {
      return { score: 0.7, reason: "Email matches name" }
    }
  }
  if (emailB && fuzzyA.length >= 3) {
    const prefix = emailB.split("@")[0].replace(/[^a-z0-9]/g, "")
    if (prefix.length >= 3 && prefix === fuzzyA) {
      return { score: 0.7, reason: "Email matches name" }
    }
  }

  // Semantic fallback: requires strong embedding similarity AND at least
  // one shared name token to avoid "same company / different person" noise.
  if (a.embedding && b.embedding && a.embedding.length === b.embedding.length) {
    const sim = cosineSimilarity(a.embedding, b.embedding)
    if (sim >= 0.93) {
      const tokensA = nameTokens(a.name)
      const tokensB = nameTokens(b.name)
      const shared = [...tokensA].some((t) => tokensB.has(t))
      if (shared) {
        return { score: 0.72, reason: "Highly similar profile" }
      }
    }
  }

  return null
}

/**
 * Find potential duplicate contacts for the given fields among the user's
 * active (non-archived) contacts. Returns matches sorted by score descending.
 */
export async function findDuplicates(
  supabase: SupabaseClient,
  userId: string,
  fields: ScorableFields
): Promise<DuplicateMatch[]> {
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("created_by", userId)
    .is("archived_at", null)

  if (error || !contacts) {
    return []
  }

  const matches: DuplicateMatch[] = []
  for (const contact of contacts as Contact[]) {
    const score = scorePair(fields, contact)
    if (score && score.score >= 0.5) {
      matches.push({ contact, score: score.score, reason: score.reason })
    }
  }

  matches.sort((a, b) => b.score - a.score)
  return matches
}

/**
 * Find an existing contact that strongly matches the given fields.
 * Returns the contact ID if a strong match is found (score >= threshold), null otherwise.
 * Use this to prevent duplicate creation — if a match is found, update instead of insert.
 */
export async function findStrongMatch(
  supabase: SupabaseClient,
  userId: string,
  fields: ScorableFields,
  threshold: number = 0.7
): Promise<{ contactId: string; reason: string } | null> {
  const matches = await findDuplicates(supabase, userId, fields)
  const strong = matches.find((m) => m.score >= threshold)
  return strong ? { contactId: strong.contact.id, reason: strong.reason } : null
}
