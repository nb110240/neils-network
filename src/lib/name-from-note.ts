// Suggests a name from the first line of a note when AI extraction found none.
// Only ever used to prefill the name prompt: the user confirms it, because
// first lines like "Coffee Chat Notes" look like names to any heuristic.

const LEAD_IN = /^(?:met|meeting with|coffee with|call with|chat with|intro to|lunch with|dinner with)\s+/i
const NAME_WORD = /^\p{Lu}[\p{L}'’-]*\.?$/u
const NOT_NAMES = new Set([
  "meeting", "notes", "note", "call", "coffee", "chat", "intro", "lunch", "dinner",
  "investor", "investors", "founder", "founders", "today", "yesterday", "tomorrow",
  "the", "and", "with", "at", "from", "summit", "conference", "event", "demo", "day",
])

export function suggestNameFromNote(note: string): string | null {
  const firstLine = (note || "").split(/\r?\n/)[0] ?? ""
  // Stop at the first clause break: "Jane Doe, partner at Acme" → "Jane Doe".
  const head = firstLine.replace(LEAD_IN, "").split(/[,;:.!?()–—]| - | at | from /)[0].trim()
  if (!head || head.length > 60) return null
  const words = head.split(/\s+/)
  if (words.length < 2 || words.length > 4) return null
  if (!words.every((word) => NAME_WORD.test(word) && !NOT_NAMES.has(word.toLowerCase().replace(/\.$/, "")))) {
    return null
  }
  return words.join(" ")
}
