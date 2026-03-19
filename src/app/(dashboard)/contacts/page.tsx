import { createClient } from "@/lib/supabase/server"
import { Contact } from "@/lib/types"
import { calculateHealthScore } from "@/lib/health"
import { ContactsClient } from "./contacts-client"

export default async function ContactsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("created_by", user.id)
    .order("name", { ascending: true })

  const contactsWithHealth = (contacts || []).map((c) => ({
    ...(c as Contact),
    health: calculateHealthScore(c.last_contact_date, c.created_at),
  }))

  // Fetch tags
  const { data: tags } = await supabase
    .from("tags")
    .select("*")
    .eq("created_by", user.id)
    .order("name", { ascending: true })

  // Fetch contact-tag mappings
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
    />
  )
}
