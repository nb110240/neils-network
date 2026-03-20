import type { SupabaseClient } from "@supabase/supabase-js"
import type { Contact } from "@/lib/types"

export interface DuplicateMatch {
  contact: Contact
  score: number
  reason: string
}

/**
 * Normalize a name for comparison: lowercase, trim, collapse whitespace.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

/**
 * Normalize a phone number for comparison: strip non-digit characters.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

/**
 * Find potential duplicate contacts for the given fields among the user's
 * active (non-archived) contacts. Returns matches sorted by score descending.
 */
/**
 * Extract the LinkedIn username slug from a URL for comparison.
 */
function extractLinkedInSlug(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/linkedin\.com\/in\/([\w-]+)/i)
  return match ? match[1].toLowerCase() : null
}

export async function findDuplicates(
  supabase: SupabaseClient,
  userId: string,
  fields: {
    name?: string | null
    email?: string | null
    phone?: string | null
    company?: string | null
    website?: string | null
  }
): Promise<DuplicateMatch[]> {
  // Fetch all active contacts for this user (single query)
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("created_by", userId)
    .is("archived_at", null)

  if (error || !contacts) {
    return []
  }

  const matches: DuplicateMatch[] = []

  const inputEmail = fields.email?.trim().toLowerCase() || null
  const inputName = fields.name ? normalizeName(fields.name) : null
  const inputPhone = fields.phone ? normalizePhone(fields.phone) : null
  const inputCompany = fields.company?.trim().toLowerCase() || null

  for (const contact of contacts as Contact[]) {
    let bestScore = 0
    let bestReason = ""

    // Same LinkedIn profile → 1.0
    const inputLinkedIn = extractLinkedInSlug(fields.website || null)
    if (inputLinkedIn && contact.website) {
      const existingLinkedIn = extractLinkedInSlug(contact.website)
      if (existingLinkedIn && inputLinkedIn === existingLinkedIn) {
        bestScore = 1.0
        bestReason = "Same LinkedIn profile"
      }
    }

    // Exact email match → 1.0
    if (inputEmail && contact.email) {
      const existingEmail = contact.email.trim().toLowerCase()
      if (inputEmail === existingEmail) {
        bestScore = 1.0
        bestReason = "Same email"
      }
    }

    // Same phone → 0.8
    if (inputPhone && contact.phone) {
      const existingPhone = normalizePhone(contact.phone)
      if (inputPhone === existingPhone && inputPhone.length > 0) {
        if (0.8 > bestScore) {
          bestScore = 0.8
          bestReason = "Same phone number"
        }
      }
    }

    // Same name + same company → 0.8
    if (inputName && contact.name && inputCompany && contact.company) {
      const existingName = normalizeName(contact.name)
      const existingCompany = contact.company.trim().toLowerCase()
      if (inputName === existingName && inputCompany === existingCompany) {
        if (0.8 > bestScore) {
          bestScore = 0.8
          bestReason = "Same name and company"
        }
      }
    }

    // Same name only → 0.6
    if (inputName && contact.name) {
      const existingName = normalizeName(contact.name)
      if (inputName === existingName) {
        if (0.6 > bestScore) {
          bestScore = 0.6
          bestReason = "Same name"
        }
      }
    }

    if (bestScore >= 0.5) {
      matches.push({ contact, score: bestScore, reason: bestReason })
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score)

  return matches
}
