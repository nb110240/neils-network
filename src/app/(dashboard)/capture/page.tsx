export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import { CaptureMeetingForm } from "./capture-meeting-form"

export default async function CaptureMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: contacts }, plan] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, company, email")
      .eq("created_by", user.id)
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(500),
    getUserPlan(user.id),
  ])

  const requestedContact = (await searchParams).contact || ""
  const initialContactId = (contacts || []).some((contact) => contact.id === requestedContact)
    ? requestedContact
    : ""

  return <CaptureMeetingForm contacts={contacts || []} plan={plan} initialContactId={initialContactId} />
}
