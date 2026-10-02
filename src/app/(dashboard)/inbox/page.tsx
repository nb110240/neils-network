export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { loadPickerContacts } from "@/lib/contact-picker"
import { AfterCallInbox } from "./after-call-inbox"

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: reviews } = await supabase
    .from("after_call_reviews")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("occurred_at", { ascending: false })
    .limit(100)

  // Reviews already matched to a contact outside the preloaded 500 must still
  // show that contact in their picker.
  const { contacts, truncated } = await loadPickerContacts(
    supabase,
    user.id,
    (reviews || []).map((review) => review.contact_id as string | null)
  )

  return <AfterCallInbox initialReviews={reviews || []} contacts={contacts} truncated={truncated} />
}
