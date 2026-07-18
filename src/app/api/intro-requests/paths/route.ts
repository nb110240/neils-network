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

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth
    const targetId = new URL(request.url).searchParams.get("target_id") || ""
    if (!isValidUUID(targetId)) return badRequestResponse("Choose a valid target")

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, name, company, job_title, how_we_met, next_steps, raw_note, last_contact_date, created_at")
      .eq("created_by", user.id)
      .is("archived_at", null)
      .limit(500)
    if (error) return errorResponse("Could not find intro paths")

    const target = (contacts || []).find((contact) => contact.id === targetId)
    if (!target) return notFoundResponse("Target not found")
    const contactIds = (contacts || []).map((contact) => contact.id)
    const { data: contactTags } = contactIds.length
      ? await supabase.from("contact_tags").select("contact_id, tags(name)").in("contact_id", contactIds)
      : { data: [] }
    const tagsByContact = new Map<string, string[]>()
    for (const row of contactTags || []) {
      const joined = row.tags as unknown as { name?: string } | { name?: string }[] | null
      const tag = Array.isArray(joined) ? joined[0]?.name : joined?.name
      if (tag) tagsByContact.set(row.contact_id, [...(tagsByContact.get(row.contact_id) || []), tag])
    }

    const withTags = (contacts || []).map((contact) => ({
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
