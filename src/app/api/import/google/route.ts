import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomBytes } from "crypto"
import { authenticateRequest, authFailed, badRequestResponse, forbiddenResponse, errorResponse } from "@/lib/api-utils"
import { getUserPlan, getPlanLimits, checkContactLimit } from "@/lib/subscription"
import { findStrongMatchInMemory } from "@/lib/dedup"
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/openai"
import type { SupabaseClient } from "@supabase/supabase-js"

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

    // CSRF protection: generate random state and store in httpOnly cookie
    const state = randomBytes(32).toString("hex")
    const cookieStore = await cookies()
    cookieStore.set("google_import_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    })

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/import/google/callback`
    const scope = "https://www.googleapis.com/auth/contacts.readonly"

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", scope)
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("state", state)

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
    const tokenCookie = cookieStore.get("google_import_token")?.value
    if (!tokenCookie) {
      return badRequestResponse("Google authorization expired. Please reconnect.")
    }

    // Verify the token belongs to the authenticated user (prevents shared-browser token reuse)
    let accessToken: string
    try {
      const parsed = JSON.parse(tokenCookie)
      if (parsed.userId !== user.id) {
        cookieStore.delete("google_import_token")
        return forbiddenResponse("Google authorization was for a different account. Please reconnect.")
      }
      accessToken = parsed.token
    } catch {
      cookieStore.delete("google_import_token")
      return badRequestResponse("Invalid Google authorization. Please reconnect.")
    }

    // Clear the token cookie after use (single-use)
    cookieStore.delete("google_import_token")

    const body = await request.json().catch(() => ({}))
    const { selectedContacts } = body as { selectedContacts?: string[] }

    // Fetch all contacts from Google People API (with pagination)
    let connections: GooglePerson[] = []
    let nextPageToken: string | undefined
    do {
      const params: Record<string, string> = {
        personFields: "names,emailAddresses,phoneNumbers,organizations",
        pageSize: "500",
      }
      if (nextPageToken) params.pageToken = nextPageToken

      const response = await fetch(
        "https://people.googleapis.com/v1/people/me/connections?" +
          new URLSearchParams(params),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (!response.ok) {
        return errorResponse("Failed to fetch Google contacts")
      }

      const data = await response.json()
      connections = connections.concat(data.connections || [])
      nextPageToken = data.nextPageToken
    } while (nextPageToken && connections.length < 2000) // Safety cap

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
          // last_contact_date intentionally omitted: importing a contact
          // is not a real interaction. Stamping today() here would mark
          // every imported record as "fresh" and hide genuinely stale
          // relationships from the health score and daily digest. Health
          // falls back to created_at when last_contact_date is null.
          source: "google_import",
          created_by: user.id,
          follow_up_needed: false,
        }
      })
      .filter(Boolean)

    if (contacts.length === 0) {
      return badRequestResponse("No valid contacts found")
    }

    // Enforce contact limit for free users
    const { allowed, count, limit } = await checkContactLimit(user.id)
    if (!allowed) {
      return forbiddenResponse(`You've reached the ${limit}-contact limit. Upgrade to Pro for unlimited contacts.`)
    }
    const remaining = limit === Infinity ? contacts.length : Math.max(0, limit - (count || 0))
    const contactsToInsert = contacts.slice(0, remaining)

    // Filter out contacts that already exist (dedup before insert).
    // Preload once; per-row DB lookups would be O(rows * existing_contacts)
    // and time out on networks with many contacts.
    const { data: existingForDedup } = await supabase
      .from("contacts")
      .select("id, name, email, phone, company, website")
      .eq("created_by", user.id)
      .is("archived_at", null)

    const existingContacts = (existingForDedup ?? []) as Array<{
      id: string
      name: string | null
      email: string | null
      phone: string | null
      company: string | null
      website: string | null
    }>

    const deduped = []
    let skippedDupes = 0
    // seen is seeded with pre-existing DB rows and extended as we accept
    // rows in this batch, so within-batch duplicates (same email appearing
    // twice in the Google export) are also deduped.
    const seen: typeof existingContacts = [...existingContacts]
    for (const c of contactsToInsert as NonNullable<(typeof contactsToInsert)[number]>[]) {
      const fields = {
        name: c.name || null,
        email: c.email || null,
        phone: c.phone || null,
        company: c.company || null,
      }
      const match = findStrongMatchInMemory(fields, seen)
      if (match) {
        skippedDupes++
      } else {
        deduped.push(c)
        seen.push({ id: "", website: null, ...fields })
      }
    }

    if (deduped.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: skippedDupes,
        message: `All ${skippedDupes} contacts already exist in your network.`,
      })
    }

    const { data: inserted, error } = await supabase
      .from("contacts")
      .insert(deduped)
      .select()

    if (error) {
      console.error("Google import error:", error)
      return errorResponse("Failed to import contacts")
    }

    // Generate embeddings in background (fire and forget for speed)
    generateEmbeddingsBatch(inserted, supabase).catch(console.error)

    return NextResponse.json({
      success: true,
      imported: inserted.length,
      skipped: skippedDupes,
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

async function generateEmbeddingsBatch(
  contacts: { id: string; raw_note: string; name: string | null; company: string | null; job_title?: string | null; email?: string | null }[],
  supabase: SupabaseClient
) {
  for (const contact of contacts) {
    const embeddingText = buildContactEmbeddingText({
      name: contact.name,
      company: contact.company,
      job_title: contact.job_title || null,
      email: contact.email || null,
      how_we_met: null,
      next_steps: null,
      raw_note: contact.raw_note,
    })
    const embedding = await generateEmbedding(embeddingText)
    const embeddingStatus = embedding ? "complete" : "failed"
    await supabase
      .from("contacts")
      .update({ embedding: embedding || undefined, embedding_status: embeddingStatus })
      .eq("id", contact.id)
  }
}
