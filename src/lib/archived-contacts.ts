import type { SupabaseClient } from "@supabase/supabase-js"
import { log } from "@/lib/logger"

/** Matches PostgREST's default max-rows cap, so a short page means we're done. */
export const ARCHIVED_ID_PAGE_SIZE = 1000

/**
 * IDs of the user's archived contacts. Deliberately the one contacts query
 * that selects archived rows: action lists use it to drop commitments and
 * intros that point at someone the user archived.
 *
 * Pages through every row (the API caps a single response) and throws on a
 * query error: an empty list would silently re-show archived people.
 */
export async function fetchArchivedContactIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const ids: string[] = []
  for (let from = 0; ; from += ARCHIVED_ID_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("created_by", userId)
      .not("archived_at", "is", null)
      .order("id")
      .range(from, from + ARCHIVED_ID_PAGE_SIZE - 1)
    if (error) throw new Error(`Failed to load archived contacts: ${error.message}`)
    const rows = (data || []) as { id: string }[]
    for (const row of rows) ids.push(row.id)
    if (rows.length < ARCHIVED_ID_PAGE_SIZE) return ids
  }
}

/**
 * Page-friendly wrapper: logs the failure and falls back to no archive
 * filter, the same way the action-list pages degrade on their other queries,
 * so one failed lookup never takes down the dashboard.
 */
export async function fetchArchivedContactIdsForPage(supabase: SupabaseClient, userId: string): Promise<string[]> {
  try {
    return await fetchArchivedContactIds(supabase, userId)
  } catch (error) {
    log("error", "Archived contact lookup failed; action list is unfiltered", {
      userId,
      action: "fetch_archived_contact_ids",
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}
