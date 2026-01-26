import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: Request,
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

    const { data: contact, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("created_by", user.id)
      .single()

    if (error || !contact) {
      return NextResponse.json({ message: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json({ contact })
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Only allow updating certain fields
    const allowedFields = [
      "name",
      "email",
      "phone",
      "company",
      "job_title",
      "website",
      "how_we_met",
      "next_steps",
      "follow_up_needed",
      "last_contact_date",
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle empty string for date
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
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
