import type { SupabaseClient } from "@supabase/supabase-js"
import { isValidUUID } from "@/lib/api-utils"

export interface ContactOption {
  id: string
  name: string | null
  company: string | null
  email: string | null
}

/** How many contacts pickers preload. Larger networks search the server. */
export const PICKER_PRELOAD_LIMIT = 500
export const PICKER_COLUMNS = "id, name, company, email"

/**
 * Loads the first PICKER_PRELOAD_LIMIT contacts by name, plus any contacts in
 * `ensureIds` that fell outside that window (a `/capture?contact=<id>` link or
 * a review already matched to a contact). Without this, preselected contacts
 * past the first 500 were silently dropped.
 */
export async function loadPickerContacts(
  supabase: SupabaseClient,
  userId: string,
  ensureIds: Array<string | null | undefined> = []
): Promise<{ contacts: ContactOption[]; truncated: boolean }> {
  const { data } = await supabase
    .from("contacts")
    .select(PICKER_COLUMNS)
    .eq("created_by", userId)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(PICKER_PRELOAD_LIMIT)

  const contacts = ((data || []) as ContactOption[]).slice()
  const truncated = contacts.length >= PICKER_PRELOAD_LIMIT
  const have = new Set(contacts.map((contact) => contact.id))
  const missing = [...new Set(ensureIds.filter((id): id is string => !!id && isValidUUID(id) && !have.has(id)))]

  if (missing.length > 0) {
    const { data: extra } = await supabase
      .from("contacts")
      .select(PICKER_COLUMNS)
      .eq("created_by", userId)
      .is("archived_at", null)
      .in("id", missing)
    contacts.push(...((extra || []) as ContactOption[]))
  }

  return { contacts, truncated }
}
