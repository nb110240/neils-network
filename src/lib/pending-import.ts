// ─── Pending tracker import ───
// A visitor can upload their filled-in investor tracker on the public
// template page before they have an account. The CSV waits in this
// browser's localStorage until they sign in, then /import picks it up.

const KEY = "savvo-pending-import"
export const PENDING_IMPORT_MAX_BYTES = 1_000_000
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface PendingImport {
  name: string
  text: string
  savedAt: number
}

/** Header plus at least one non-empty data row. */
export function countCsvDataRows(text: string): number {
  const lines = text.split(/\r?\n/).filter((line) => line.replace(/,/g, "").trim() !== "")
  return Math.max(0, lines.length - 1)
}

// Example rows shipped in public/templates/investor-pipeline-tracker.csv.
const TEMPLATE_EXAMPLE_NAMES = new Set(["jane example", "sam placeholder", "ana sample"])

/** True when every data row is one of the template's example investors. */
export function isUneditedTemplate(text: string): boolean {
  const rows = text.split(/\r?\n/).slice(1).filter((line) => line.replace(/,/g, "").trim() !== "")
  if (rows.length === 0) return false
  return rows.every((line) => TEMPLATE_EXAMPLE_NAMES.has(line.split(",")[0].replace(/"/g, "").trim().toLowerCase()))
}

export function savePendingImport(name: string, text: string): boolean {
  try {
    const value: PendingImport = { name: name.slice(0, 200), text, savedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(value))
    return true
  } catch {
    // Storage blocked or full (private mode, quota): caller falls back.
    return false
  }
}

export function readPendingImport(now = Date.now()): PendingImport | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<PendingImport>
    if (typeof value.text !== "string" || typeof value.name !== "string" || typeof value.savedAt !== "number") {
      localStorage.removeItem(KEY)
      return null
    }
    if (now - value.savedAt > TTL_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return value as PendingImport
  } catch {
    return null
  }
}

export function clearPendingImport() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
