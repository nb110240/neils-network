import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"

function escapeCsvField(value: string | null): string {
  if (!value) return ""
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
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

    const rl = await rateLimit(user.id, "general")
    if (!rl.success) {
      return NextResponse.json({ message: "Too many requests" }, { status: 429 })
    }

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("name, email, phone, company, job_title, website, how_we_met, last_contact_date")
      .eq("created_by", user.id)
      .order("name", { ascending: true })

    if (error) {
      console.error("Export contacts error:", error)
      return NextResponse.json({ message: "Failed to export contacts" }, { status: 500 })
    }

    const headers = ["Name", "Email", "Phone", "Company", "Job Title", "Website", "How We Met", "Last Contact Date"]
    const csvRows = [headers.join(",")]

    for (const contact of contacts || []) {
      const row = [
        escapeCsvField(contact.name),
        escapeCsvField(contact.email),
        escapeCsvField(contact.phone),
        escapeCsvField(contact.company),
        escapeCsvField(contact.job_title),
        escapeCsvField(contact.website),
        escapeCsvField(contact.how_we_met),
        escapeCsvField(contact.last_contact_date),
      ]
      csvRows.push(row.join(","))
    }

    const csv = csvRows.join("\n")

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="savvo-contacts-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("Export contacts error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
