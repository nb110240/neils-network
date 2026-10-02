export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import { loadPickerContacts } from "@/lib/contact-picker"
import { CaptureMeetingForm } from "./capture-meeting-form"

export default async function CaptureMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const requestedContact = (await searchParams).contact || ""
  const [{ contacts, truncated }, plan] = await Promise.all([
    // Fetches the requested contact explicitly when it falls outside the
    // preloaded 500, so /capture?contact=<id> never silently drops it.
    loadPickerContacts(supabase, user.id, [requestedContact]),
    getUserPlan(user.id),
  ])

  const initialContactId = contacts.some((contact) => contact.id === requestedContact)
    ? requestedContact
    : ""

  return <CaptureMeetingForm contacts={contacts} truncated={truncated} plan={plan} initialContactId={initialContactId} />
}
