import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAllRows } from "@/lib/fetch-all"

/**
 * IDs of the user's archived contacts. Deliberately the one contacts query
 * that selects archived rows: action lists use it to drop commitments and
 * intros that point at someone the user archived.
 */
export async function fetchArchivedContactIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  // Paged: the API returns at most 1,000 rows per request.
  const { data } = await fetchAllRows((from, to) =>
    supabase
      .from("contacts")
      .select("id")
      .eq("created_by", userId)
      .not("archived_at", "is", null)
      .order("id", { ascending: true })
      .range(from, to)
  )
  return (data || []).map((row: { id: string }) => row.id)
}
