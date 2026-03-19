import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserPlan, getPlanLimits } from "@/lib/subscription"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

// Step 1: Get Google OAuth URL
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
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const plan = await getUserPlan(user.id)
    const limits = getPlanLimits(plan)
    if (!limits.canImport) {
      return NextResponse.json(
        { message: "Import is a Pro feature" },
        { status: 403 }
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { message: "Google OAuth not configured" },
        { status: 500 }
      )
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
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

// Step 2: Import contacts using access token
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Rate limit: 5 imports per hour
    const rl = await rateLimit(user.id, "import")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many imports. Please wait before trying again." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { accessToken, selectedContacts } = await request.json()

    if (!accessToken) {
      return NextResponse.json(
        { message: "Access token required" },
        { status: 400 }
      )
    }

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
      return NextResponse.json(
        { message: "Failed to fetch Google contacts" },
        { status: 500 }
      )
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
      return NextResponse.json(
        { message: "No valid contacts found" },
        { status: 400 }
      )
    }

    const { data: inserted, error } = await supabase
      .from("contacts")
      .insert(contacts)
      .select()

    if (error) {
      console.error("Google import error:", error)
      return NextResponse.json(
        { message: "Failed to import contacts" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imported: inserted.length,
      available: connections.length,
    })
  } catch (error) {
    console.error("Google import error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

interface GooglePerson {
  names?: { displayName: string }[]
  emailAddresses?: { value: string }[]
  phoneNumbers?: { value: string }[]
  organizations?: { name: string; title: string }[]
}
