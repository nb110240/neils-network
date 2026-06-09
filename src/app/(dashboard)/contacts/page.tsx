export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { Contact } from "@/lib/types"
import { calculateHealthScore } from "@/lib/health"
import { ContactsClient } from "./contacts-client"

const PAGE_SIZE = 25

export default async function ContactsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // The full Contact shape MINUS the 1536-dim `embedding` vector (~6-20KB/row),
  // which the UI never reads — `select("*")` was shipping it on every row.
  const CONTACT_COLUMNS =
    "id, name, email, phone, company, job_title, website, how_we_met, next_steps, follow_up_needed, last_contact_date, raw_note, embedding_status, source, created_by, cadence_days, scheduled_follow_up, snoozed_until, next_due_date, created_at, updated_at, archived_at"

  // total, the first page, and tags are independent (only need user.id) — run
  // them in parallel instead of three serial round-trips.
  const [{ count: total }, { data: contacts }, { data: tags }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("created_by", user.id)
      .is("archived_at", null),
    supabase
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("created_by", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1),
    supabase
      .from("tags")
      .select("*")
      .eq("created_by", user.id)
      .order("name", { ascending: true }),
  ])

  const results = contacts || []
  const hasMore = results.length > PAGE_SIZE
  const pageContacts = hasMore ? results.slice(0, PAGE_SIZE) : results

  const contactsWithHealth = pageContacts.map((c) => ({
    ...(c as Contact),
    health: calculateHealthScore(c.last_contact_date, c.created_at),
  }))

  const lastItem = contactsWithHealth[contactsWithHealth.length - 1]
  const nextCursor = hasMore && lastItem ? lastItem.created_at : null

  // Fetch contact-tag mappings for the first page
  const contactIds = contactsWithHealth.map((c) => c.id)
  let contactTagMap: Record<string, string[]> = {}

  if (contactIds.length > 0) {
    const { data: contactTags } = await supabase
      .from("contact_tags")
      .select("contact_id, tag_id")
      .in("contact_id", contactIds)

    if (contactTags) {
      contactTagMap = contactTags.reduce(
        (acc: Record<string, string[]>, ct: { contact_id: string; tag_id: string }) => {
          if (!acc[ct.contact_id]) acc[ct.contact_id] = []
          acc[ct.contact_id].push(ct.tag_id)
          return acc
        },
        {}
      )
    }
  }

  return (
    <ContactsClient
      contacts={contactsWithHealth}
      tags={tags || []}
      contactTagMap={contactTagMap}
      pagination={{
        hasMore,
        nextCursor,
        total: total || 0,
      }}
    />
  )
}
