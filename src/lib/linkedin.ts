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
