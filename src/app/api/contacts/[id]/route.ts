import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { calculateHealthScore } from "@/lib/health"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { z } from "zod/v4"

const UpdateContactSchema = z.object({
  name: z.string().max(255).nullable().optional(),
  email: z.string().email().max(320).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  company: z.string().max(255).nullable().optional(),
  job_title: z.string().max(255).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  how_we_met: z.string().max(5000).nullable().optional(),
  next_steps: z.string().max(5000).nullable().optional(),
  follow_up_needed: z.boolean().optional(),
  last_contact_date: z.string().nullable().optional(),
  raw_note: z.string().max(10000).nullable().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ message: "Invalid contact ID" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const rl = await rateLimit(user.id, "general")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (error || !contact) {
      return NextResponse.json({ message: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json({
      contact: {
        ...contact,
        health: calculateHealthScore(contact.last_contact_date, contact.created_at),
      },
    })
  } catch (error) {
    console.error("Error fetching contact:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ message: "Invalid contact ID" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const rl = await rateLimit(user.id, "general")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const body = await request.json()

    const parsed = UpdateContactSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsed.error.format() },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }

    if (updateData.last_contact_date === "") {
      updateData.last_contact_date = null
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", id)
      .eq("created_by", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating contact:", error)
      return NextResponse.json(
        { message: "Failed to update contact" },
        { status: 500 }
      )
    }

    return NextResponse.json({ contact })
  } catch (error) {
    console.error("Error updating contact:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ message: "Invalid contact ID" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const rl = await rateLimit(user.id, "general")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id)
      .eq("created_by", user.id)

    if (error) {
      console.error("Error deleting contact:", error)
      return NextResponse.json(
        { message: "Failed to delete contact" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting contact:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
