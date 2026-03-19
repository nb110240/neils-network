import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractContactInfo } from "@/lib/extract-contact"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Rate limit: uses create limiter since this calls OpenAI
    const rl = await rateLimit(user.id, "create")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .select("id, raw_note, created_by")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (error || !contact) {
      return NextResponse.json({ message: "Contact not found" }, { status: 404 })
    }

    const extracted = await extractContactInfo(contact.raw_note)

    const { data: fixed, error: updateError } = await supabase
      .from("contacts")
      .update(extracted)
      .eq("id", id)
      .eq("created_by", user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ message: "Failed to update contact" }, { status: 500 })
    }

    return NextResponse.json({ contact: fixed })
  } catch (error) {
    console.error("Error fixing contact:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
