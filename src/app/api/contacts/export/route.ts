import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"

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
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("name, email, phone, company, job_title, website, how_we_met, next_steps, follow_up_needed, last_contact_date, raw_note, source, created_at")
      .eq("created_by", user.id)
      .order("name", { ascending: true })

    if (error) {
      console.error("Export contacts error:", error)
      return errorResponse("Failed to export contacts")
    }

    const headers = ["Name", "Email", "Phone", "Company", "Job Title", "Website", "How We Met", "Next Steps", "Follow-up Needed", "Last Contact Date", "Notes", "Source", "Added On"]
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
        escapeCsvField(contact.next_steps),
        contact.follow_up_needed ? "Yes" : "No",
        escapeCsvField(contact.last_contact_date),
        escapeCsvField(contact.raw_note),
        escapeCsvField(contact.source),
        escapeCsvField(contact.created_at ? new Date(contact.created_at).toISOString().split("T")[0] : null),
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
    return errorResponse("Internal server error")
  }
}
