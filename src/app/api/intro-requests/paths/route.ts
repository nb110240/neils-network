import { NextResponse } from "next/server"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
  isValidUUID,
  notFoundResponse,
} from "@/lib/api-utils"
import { rankIntroPaths, type IntroPathContact } from "@/lib/intro-paths"
import { fetchAllRows } from "@/lib/fetch-all"

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth
    const targetId = new URL(request.url).searchParams.get("target_id") || ""
    if (!isValidUUID(targetId)) return badRequestResponse("Choose a valid target")

    // Paged: the API returns at most 1,000 rows per request. The old
    // .limit(500) answered "Target not found" for anyone past row 500.
    const { data: contacts, error } = await fetchAllRows((from, to) =>
      supabase
        .from("contacts")
        .select("id, name, company, job_title, how_we_met, next_steps, raw_note, last_contact_date, created_at")
        .eq("created_by", user.id)
        .is("archived_at", null)
        .order("id", { ascending: true })
        .range(from, to)
    )
    if (error) return errorResponse("Could not find intro paths")

    const target = contacts.find((contact) => contact.id === targetId)
    if (!target) return notFoundResponse("Target not found")
    // Tags are scoped by owner through the join rather than an id list:
    // thousands of ids in .in() would overflow the request URL.
    const { data: contactTags } = await fetchAllRows((from, to) =>
      supabase
        .from("contact_tags")
        .select("contact_id, tags(name), contacts!inner(created_by)")
        .eq("contacts.created_by", user.id)
        .order("contact_id", { ascending: true })
        .order("tag_id", { ascending: true })
        .range(from, to)
    )
    const tagsByContact = new Map<string, string[]>()
    for (const row of contactTags || []) {
      const joined = row.tags as unknown as { name?: string } | { name?: string }[] | null
      const tag = Array.isArray(joined) ? joined[0]?.name : joined?.name
      if (tag) tagsByContact.set(row.contact_id, [...(tagsByContact.get(row.contact_id) || []), tag])
    }

    const withTags = contacts.map((contact) => ({
      ...contact,
      tags: tagsByContact.get(contact.id) || [],
    })) as IntroPathContact[]
    const targetWithTags = withTags.find((contact) => contact.id === targetId)!
    return NextResponse.json({
      target: targetWithTags,
      paths: rankIntroPaths(targetWithTags, withTags).slice(0, 5),
    })
  } catch (error) {
    console.error("Intro paths error:", error)
    return errorResponse("Could not find intro paths")
  }
}
