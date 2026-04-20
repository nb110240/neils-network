import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { scorePair } from "@/lib/dedup"

interface ContactRow {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  website: string | null
  embedding: number[] | null
}

function canonicalKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export async function GET() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data: contactsRaw } = await supabase
      .from("contacts")
      .select("id, name, email, phone, company, website, embedding")
      .eq("created_by", user.id)
      .is("archived_at", null)

    const contacts = (contactsRaw as ContactRow[] | null) ?? []
    if (contacts.length < 2) {
      return NextResponse.json({ count: 0, highConfidence: 0 })
    }

    const { data: dismissedRows } = await supabase
      .from("not_duplicate_pairs")
      .select("contact_a_id, contact_b_id")
      .eq("user_id", user.id)

    const dismissed = new Set(
      (dismissedRows ?? []).map((r) => canonicalKey(r.contact_a_id, r.contact_b_id))
    )

    const involved = new Set<string>()
    const highInvolved = new Set<string>()

    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const key = canonicalKey(contacts[i].id, contacts[j].id)
        if (dismissed.has(key)) continue
        const result = scorePair(contacts[i], contacts[j])
        if (result && result.score >= 0.5) {
          involved.add(contacts[i].id)
          involved.add(contacts[j].id)
          if (result.score >= 0.9) {
            highInvolved.add(contacts[i].id)
            highInvolved.add(contacts[j].id)
          }
        }
      }
    }

    return NextResponse.json({
      count: Math.floor(involved.size / 2) || (involved.size > 0 ? 1 : 0),
      highConfidence: Math.floor(highInvolved.size / 2) || (highInvolved.size > 0 ? 1 : 0),
      contactsInvolved: involved.size,
    })
  } catch (error) {
    console.error("Duplicate count error:", error)
    return errorResponse("Failed to count duplicates")
  }
}
