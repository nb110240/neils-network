import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { authenticateRequest, authFailed, badRequestResponse, forbiddenResponse, errorResponse } from "@/lib/api-utils"
import { getUserPlan, getPlanLimits } from "@/lib/subscription"

// Step 1: Get Google OAuth URL
export async function GET() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const plan = await getUserPlan(user.id)
    const limits = getPlanLimits(plan)
    if (!limits.canImport) {
      return forbiddenResponse("Import is a Pro feature")
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return errorResponse("Google OAuth not configured")
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/import/google/callback`
    const scope = "https://www.googleapis.com/auth/contacts.readonly"

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", scope)
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")

    return NextResponse.json({ url: authUrl.toString() })
  } catch (error) {
    console.error("Google auth URL error:", error)
    return errorResponse("Internal server error")
  }
}

// Step 2: Import contacts using access token
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("import")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // Read token from secure httpOnly cookie (set by callback route)
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("google_import_token")?.value
    if (!accessToken) {
      return badRequestResponse("Google authorization expired. Please reconnect.")
    }

    // Clear the token cookie after use (single-use)
    cookieStore.delete("google_import_token")

    const body = await request.json().catch(() => ({}))
    const { selectedContacts } = body as { selectedContacts?: string[] }

    // Fetch contacts from Google People API
    const response = await fetch(
      "https://people.googleapis.com/v1/people/me/connections?" +
        new URLSearchParams({
          personFields: "names,emailAddresses,phoneNumbers,organizations",
          pageSize: "500",
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!response.ok) {
      return errorResponse("Failed to fetch Google contacts")
    }

    const data = await response.json()
    const connections = data.connections || []

    // If selectedContacts provided, filter to only those
    const selectedSet = selectedContacts
      ? new Set(selectedContacts as string[])
      : null

    const contacts = connections
      .map((person: GooglePerson, index: number) => {
        if (selectedSet && !selectedSet.has(String(index))) return null

        const name = person.names?.[0]?.displayName || null
        if (!name) return null

        const email = person.emailAddresses?.[0]?.value || null
        const phone = person.phoneNumbers?.[0]?.value || null
        const company = person.organizations?.[0]?.name || null
        const jobTitle = person.organizations?.[0]?.title || null

        return {
          name,
          email,
          phone,
          company,
          job_title: jobTitle,
          raw_note: `Imported from Google Contacts. ${name}${company ? ` at ${company}` : ""}`,
          source: "google_import",
          created_by: user.id,
          follow_up_needed: false,
        }
      })
      .filter(Boolean)

    if (contacts.length === 0) {
      return badRequestResponse("No valid contacts found")
    }

    const { data: inserted, error } = await supabase
      .from("contacts")
      .insert(contacts)
      .select()

    if (error) {
      console.error("Google import error:", error)
      return errorResponse("Failed to import contacts")
    }

    return NextResponse.json({
      success: true,
      imported: inserted.length,
      available: connections.length,
    })
  } catch (error) {
    console.error("Google import error:", error)
    return errorResponse("Internal server error")
  }
}

interface GooglePerson {
  names?: { displayName: string }[]
  emailAddresses?: { value: string }[]
  phoneNumbers?: { value: string }[]
  organizations?: { name: string; title: string }[]
}
