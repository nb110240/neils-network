import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * IDs of the user's archived contacts. Deliberately the one contacts query
 * that selects archived rows: action lists use it to drop commitments and
 * intros that point at someone the user archived.
 */
export async function fetchArchivedContactIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .eq("created_by", userId)
    .not("archived_at", "is", null)
  return (data || []).map((row: { id: string }) => row.id)
}
