// ─── Pending tracker import ───
// A visitor can upload their filled-in investor tracker on the public
// template page before they have an account. The CSV waits in this
// browser's localStorage until they sign in, then /import picks it up.

import Papa from "papaparse"

const KEY = "savvo-pending-import"
export const PENDING_IMPORT_MAX_BYTES = 1_000_000
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface PendingImport {
  name: string
  text: string
  savedAt: number
}

/** Parsed CSV records with blank and delimiter-only rows dropped. */
function csvRecords(text: string): string[][] {
  // Parse records, not lines: a quoted field can contain a newline.
  return Papa.parse<string[]>(text, { skipEmptyLines: "greedy" }).data
}

/** Data records after the header (blank and comma-only rows ignored). */
export function countCsvDataRows(text: string): number {
  return Math.max(0, csvRecords(text).length - 1)
}

// Example rows shipped in public/templates/investor-pipeline-tracker.csv.
const TEMPLATE_EXAMPLE_NAMES = new Set(["jane example", "sam placeholder", "ana sample"])

/** True when every data row is one of the template's example investors. */
export function isUneditedTemplate(text: string): boolean {
  const rows = csvRecords(text).slice(1)
  if (rows.length === 0) return false
  return rows.every((row) => TEMPLATE_EXAMPLE_NAMES.has((row[0] ?? "").trim().toLowerCase()))
}

export function savePendingImport(name: string, text: string): boolean {
  try {
    const value: PendingImport = { name: name.slice(0, 200), text, savedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(value))
    return true
  } catch {
    // Storage blocked or full (private mode, quota): caller falls back.
    // A failed setItem leaves any older pending file in place; drop it so
    // the post-signup redirect can't open a file the visitor replaced.
    clearPendingImport()
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

/**
 * Hand the pending file to `load`, which resolves true once the server has
 * answered for good (parsed it, or rejected it as invalid). Only then is the
 * pending copy cleared, so a dropped request or server error keeps it for the
 * next visit to /import instead of losing the visitor's upload.
 */
export async function resumePendingImport(
  pending: PendingImport,
  load: (file: File) => Promise<boolean>,
): Promise<void> {
  const settled = await load(new File([pending.text], pending.name, { type: "text/csv" }))
  if (settled) clearPendingImport()
}
