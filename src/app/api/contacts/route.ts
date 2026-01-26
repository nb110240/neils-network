import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { raw_note } = body

    if (!raw_note || typeof raw_note !== "string") {
      return NextResponse.json(
        { message: "raw_note is required" },
        { status: 400 }
      )
    }

    // Send to n8n webhook
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET

    if (!webhookUrl) {
      return NextResponse.json(
        { message: "Webhook URL not configured" },
        { status: 500 }
      )
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": webhookSecret || "",
      },
      body: JSON.stringify({
        raw_note,
        user_id: user.id,
        source: "web",
      }),
    })

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text()
      console.error("Webhook error:", errorText)
      return NextResponse.json(
        { message: "Failed to process contact" },
        { status: 500 }
      )
    }

    const result = await webhookResponse.json()

    return NextResponse.json({
      success: true,
      contact: result.contact || result,
    })
  } catch (error) {
    console.error("Error creating contact:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching contacts:", error)
      return NextResponse.json(
        { message: "Failed to fetch contacts" },
        { status: 500 }
      )
    }

    return NextResponse.json({ contacts })
  } catch (error) {
    console.error("Error fetching contacts:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
