// ─── Validate AI-extracted contact fields ───
//
// GPT-4o-mini can hallucinate fields (invent email addresses, fake phone numbers).
// This module validates extracted fields and strips invalid ones rather than
// storing garbage data that users would trust.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^[+\d(][\d\s\-().]{6,}$/
const URL_REGEX = /^https?:\/\/.+\..+/i

/**
 * Validate and clean AI-extracted contact fields.
 * Invalid fields are set to null rather than stored.
 * Returns the cleaned extraction result.
 */
export function validateExtraction(extracted: Record<string, unknown>): Record<string, unknown> {
  const result = { ...extracted }

  // Validate email
  if (result.email && typeof result.email === "string") {
    if (!EMAIL_REGEX.test(result.email.trim())) {
      result.email = null
    }
  }

  // Validate phone
  if (result.phone && typeof result.phone === "string") {
    if (!PHONE_REGEX.test(result.phone.trim())) {
      result.phone = null
    }
  }

  // Validate website/URL
  if (result.website && typeof result.website === "string") {
    const website = result.website.trim()
    // Allow LinkedIn URLs and general URLs
    if (!URL_REGEX.test(website) && !website.includes("linkedin.com")) {
      result.website = null
    }
  }

  // Validate last_contact_date is a valid ISO date
  if (result.last_contact_date && typeof result.last_contact_date === "string") {
    const date = new Date(result.last_contact_date)
    if (isNaN(date.getTime())) {
      result.last_contact_date = null
    }
  }

  return result
}
