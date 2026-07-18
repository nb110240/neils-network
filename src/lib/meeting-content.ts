import { createHash } from "crypto"

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
}

export function normalizeMeetingText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
}

export function hashMeetingContent(value: string): string {
  return createHash("sha256").update(normalizeMeetingText(value)).digest("hex")
}

export function htmlToPlainText(html: string): string {
  return normalizeMeetingText(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number(value)))
      .replace(/&#x([\da-f]+);/gi, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 16)))
      .replace(/&([a-z]+);/gi, (entity, name: string) => HTML_ENTITY_MAP[name.toLowerCase()] ?? entity)
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
  )
}

export function extractEmailAddress(value: string): string | null {
  const bracketed = value.match(/<([^<>\s]+@[^<>\s]+)>/)
  const bare = value.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  return (bracketed?.[1] || bare?.[0] || "").toLowerCase() || null
}
