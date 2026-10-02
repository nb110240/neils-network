import type { SupabaseClient } from "@supabase/supabase-js"
import type { Contact } from "@/lib/types"
import { fetchAllRows } from "@/lib/fetch-all"

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
 * Check whether two names are consistent enough to treat as the same
 * person. Used as a secondary safety check before auto-merging: an
 * identifier (email/LinkedIn) hit is necessary but not sufficient —
 * if the extracted name clearly disagrees with the matched contact's
 * name, the note is likely about a different person who happened to
 * share an email, and we should route to explicit review instead.
 *
 * The check is deliberately STRICT — a single shared token (e.g.
 * both "Smith") is not enough, because "John Smith" and "Jane Smith"
 * would merge under a loose check. Agreement requires either:
 *   - either name is missing (can't disagree),
 *   - normalized whole name match (case/whitespace-insensitive),
 *   - fuzzy alpha-only match (handles punctuation/spacing variants),
 *   - or BOTH tokens of a multi-word name match (first AND last).
 * Anything weaker routes to explicit review.
 */
export function namesAgree(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return true
  const normA = normalizeName(a)
  const normB = normalizeName(b)
  if (!normA || !normB) return true
  if (normA === normB) return true
  const fuzzyA = fuzzyName(a)
  const fuzzyB = fuzzyName(b)
  if (fuzzyA && fuzzyA === fuzzyB) return true

  // Multi-token check: require every significant token in the shorter
  // name to appear in the longer one. "Robert J Smith" vs "Robert Smith"
  // agrees. "John Smith" vs "Jane Smith" does not (John ≠ Jane).
  const tokensA = nameTokens(a)
  const tokensB = nameTokens(b)
  if (tokensA.size === 0 || tokensB.size === 0) return false
  const [shorter, longer] = tokensA.size <= tokensB.size
    ? [tokensA, tokensB]
    : [tokensB, tokensA]
  if (shorter.size < 2) return false
  for (const t of shorter) {
    if (!longer.has(t)) return false
  }
  return true
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
 * Keys two contacts must share for scorePair to flag them: one per rule it
 * checks. Email-matches-name pairs meet under the fuzzy-name key, and the
 * semantic fallback needs a shared name token, so it meets under a token key.
 */
function candidateKeys(c: ScorableFields): string[] {
  const keys: string[] = []
  const email = c.email?.trim().toLowerCase() || ""
  if (email) {
    keys.push(`e:${email}`)
    const prefix = email.split("@")[0].replace(/[^a-z0-9]/g, "")
    if (prefix.length >= 3) keys.push(`f:${prefix}`)
  }
  const slug = extractLinkedInSlug(c.website ?? null)
  if (slug) keys.push(`l:${slug}`)
  const phone = c.phone ? normalizePhone(c.phone) : ""
  if (phone) keys.push(`p:${phone}`)
  const name = c.name ? normalizeName(c.name) : ""
  if (name) keys.push(`n:${name}`)
  const fuzzy = fuzzyName(c.name)
  if (fuzzy.length >= 3) keys.push(`f:${fuzzy}`)
  if (c.embedding) for (const token of nameTokens(c.name)) keys.push(`t:${token}`)
  return keys
}

/**
 * Index pairs [i, j] (i < j, in scan order) that could be duplicates: every
 * pair scorePair can flag shares a candidate key, so scoring only these
 * gives the same result as scoring all n² pairs, at a fraction of the cost
 * for large contact lists.
 */
export function duplicateCandidatePairs(contacts: ScorableFields[]): Array<[number, number]> {
  const buckets = new Map<string, number[]>()
  contacts.forEach((contact, index) => {
    for (const key of new Set(candidateKeys(contact))) {
      const bucket = buckets.get(key)
      if (bucket) bucket.push(index)
      else buckets.set(key, [index])
    }
  })
  const partners = new Map<number, Set<number>>()
  for (const bucket of buckets.values()) {
    for (let x = 0; x < bucket.length; x++) {
      for (let y = x + 1; y < bucket.length; y++) {
        const set = partners.get(bucket[x])
        if (set) set.add(bucket[y])
        else partners.set(bucket[x], new Set([bucket[y]]))
      }
    }
  }
  const pairs: Array<[number, number]> = []
  for (const i of [...partners.keys()].sort((p, q) => p - q)) {
    for (const j of [...partners.get(i)!].sort((p, q) => p - q)) pairs.push([i, j])
  }
  return pairs
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
  // Paged: the API returns at most 1,000 rows per request, and a duplicate
  // hiding past row 1,000 must still be found.
  const { data: contacts, error } = await fetchAllRows((from, to) =>
    supabase
      .from("contacts")
      .select("*")
      .eq("created_by", userId)
      .is("archived_at", null)
      .order("id", { ascending: true })
      .range(from, to)
  )

  if (error) {
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
 * findDuplicates against a pre-fetched contact list. Bulk paths (CSV
 * import) preload contacts once; calling findDuplicates per row re-reads
 * every contact, embeddings included, for each imported row.
 */
export function findDuplicatesInMemory<T extends ScorableFields & { id: string }>(
  fields: ScorableFields,
  contacts: T[]
): Array<{ contact: T; score: number; reason: string }> {
  const matches: Array<{ contact: T; score: number; reason: string }> = []
  for (const contact of contacts) {
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
 *
 * Default threshold is 1.0 so only exact stable-identifier matches auto-merge:
 * exact email (1.0) or exact LinkedIn slug (1.0). Phone (0.9) is deliberately
 * below because different people can share a number (recycled lines, family
 * plans). Name-based scores (0.75–0.85) also fall through. Any of those
 * should route to the explicit review UI where the user picks the winner
 * side-by-side; a silent merge would corrupt the record irreversibly.
 */
export async function findStrongMatch(
  supabase: SupabaseClient,
  userId: string,
  fields: ScorableFields,
  threshold: number = 1.0
): Promise<{ contactId: string; reason: string } | null> {
  const matches = await findDuplicates(supabase, userId, fields)
  const strong = matches.find((m) => m.score >= threshold)
  return strong ? { contactId: strong.contact.id, reason: strong.reason } : null
}

/**
 * Strong-match check against a pre-fetched contact list. Same semantics as
 * findStrongMatch (default threshold 1.0 = exact stable identifier), but
 * avoids the per-row database round trip that makes bulk imports O(rows ×
 * existing_contacts) queries. Preload contacts once at the start of the
 * import and pass them in.
 */
export function findStrongMatchInMemory(
  fields: ScorableFields,
  contacts: Array<ScorableFields & { id: string }>,
  threshold: number = 1.0
): { contactId: string; reason: string } | null {
  for (const contact of contacts) {
    const result = scorePair(fields, contact)
    if (result && result.score >= threshold) {
      return { contactId: contact.id, reason: result.reason }
    }
  }
  return null
}
