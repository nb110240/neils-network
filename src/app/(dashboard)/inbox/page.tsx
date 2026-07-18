export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { AfterCallInbox } from "./after-call-inbox"

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: reviews }, { data: contacts }] = await Promise.all([
    supabase
      .from("after_call_reviews")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase
      .from("contacts")
      .select("id, name, company, email")
      .eq("created_by", user.id)
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(500),
  ])

  return <AfterCallInbox initialReviews={reviews || []} contacts={contacts || []} />
}
