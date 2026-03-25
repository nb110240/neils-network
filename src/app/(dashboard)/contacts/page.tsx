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

  // Get total count (exclude archived)
  const { count: total } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user.id)
    .is("archived_at", null)

  // Fetch the first page ordered by created_at DESC (exclude archived)
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("created_by", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1)

  const results = contacts || []
  const hasMore = results.length > PAGE_SIZE
  const pageContacts = hasMore ? results.slice(0, PAGE_SIZE) : results

  const contactsWithHealth = pageContacts.map((c) => ({
    ...(c as Contact),
    health: calculateHealthScore(c.last_contact_date, c.created_at),
  }))

  const lastItem = contactsWithHealth[contactsWithHealth.length - 1]
  const nextCursor = hasMore && lastItem ? lastItem.created_at : null

  // Fetch tags
  const { data: tags } = await supabase
    .from("tags")
    .select("*")
    .eq("created_by", user.id)
    .order("name", { ascending: true })

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
