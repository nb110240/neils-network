// ─── LinkedIn profile slug → display name ───
// Share Profile URLs end in an ID suffix: digits ("john-doe-123") or, more
// often now, hex ("priya-raman-4b7a1b2c3"). Name words never contain digits,
// so a trailing segment with any digit is the suffix, not part of the name.
// Slugs for accented names arrive percent-encoded ("jos%C3%A9-garc%C3%ADa").
export function nameFromLinkedInSlug(slug: string): string {
  let decoded = slug
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    // Malformed escape sequence: fall back to the raw slug.
  }
  const parts = decoded.split("-").filter(Boolean)
  if (parts.length > 1 && /\d/.test(parts[parts.length - 1])) parts.pop()
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

// ─── LinkedIn profile URL normalization ───
// Real-world inputs: "Share Profile" links with tracking params, country
// subdomains (uk.linkedin.com, de.linkedin.com), the mobile host
// (m.linkedin.com), bare "linkedin.com/in/..." without a scheme, trailing
// slashes, and percent-encoded slugs for accented names. All map to one
// canonical https://www.linkedin.com/in/<slug> so duplicate checks compare
// like with like.
const LINKEDIN_HOST = /^(?:(?:[a-z]{2,3}|m)\.)?linkedin\.com$/i
const PROFILE_PATH = /^\/in\/((?:[\w-]|%[0-9a-f]{2})+)\/?$/i

/**
 * `slug` is lowercased for storage and matching; `rawSlug` keeps the original
 * casing for deriving a display name.
 */
export function normalizeLinkedInProfileUrl(
  input: string
): { url: string; slug: string; rawSlug: string } | null {
  let raw = (input || "").trim()
  if (!raw) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  if (!LINKEDIN_HOST.test(parsed.hostname)) return null
  const match = parsed.pathname.match(PROFILE_PATH)
  if (!match) return null
  let slug: string
  try {
    // Lowercase, and re-encode so "%c3%a9" and "%C3%A9" compare equal.
    slug = encodeURIComponent(decodeURIComponent(match[1]).toLowerCase())
  } catch {
    return null
  }
  return { url: `https://www.linkedin.com/in/${slug}`, slug, rawSlug: match[1] }
}

// ─── LinkedIn URL in free text (QR payloads, pasted input) ───
// Finds a profile or lnkd.in link with or without a scheme ("www.linkedin.com/
// in/...", as typed or shared, has none). The lookbehind stops a match from
// starting mid-host, so "evil-linkedin.com/in/x" is not read as linkedin.com.
// The API re-validates with normalizeLinkedInProfileUrl.
const PROFILE_IN_TEXT = [
  /(?<![\w.-])(?:https?:\/\/)?(?:(?:[a-z]{2,3}|m)\.)?linkedin\.com\/in\/(?:[\w-]|%[0-9a-f]{2})+\/?/i,
  /(?<![\w.-])(?:https?:\/\/)?lnkd\.in\/[\w-]+/i,
]

export function extractLinkedInUrl(text: string): string | null {
  for (const pattern of PROFILE_IN_TEXT) {
    const match = (text || "").match(pattern)
    if (match) return match[0]
  }
  return null
}
