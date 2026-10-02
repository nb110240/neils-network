import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { PICKER_COLUMNS } from "@/lib/contact-picker"
import { ilikeAnyFilter } from "@/lib/ilike-filter"

// Lightweight name/email/company lookup for contact pickers. Pickers preload
// the first 500 contacts; this finds the rest. Plain ILIKE, no embeddings, so
// it does not count against the semantic search quota.
// Capped at 20 on purpose: this backs a typeahead, so a broad query that
// matches more than 20 contacts is narrowed by typing more of the name,
// email or company rather than paged through.
export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest("search")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 100)
    if (q.length < 2) return NextResponse.json({ contacts: [] })

    const { data, error } = await supabase
      .from("contacts")
      .select(PICKER_COLUMNS)
      .eq("created_by", user.id)
      .is("archived_at", null)
      .or(ilikeAnyFilter(["name", "email", "company"], q))
      .order("name", { ascending: true })
      .limit(20)

    if (error) return errorResponse("Could not search contacts")
    return NextResponse.json({ contacts: data || [] })
  } catch (error) {
    console.error("Contact lookup error:", error)
    return errorResponse("Could not search contacts")
  }
}
