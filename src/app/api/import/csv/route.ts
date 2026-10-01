import { NextResponse, after } from "next/server"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { authenticateRequest, authFailed, badRequestResponse, forbiddenResponse, errorResponse } from "@/lib/api-utils"
import { getUserPlan } from "@/lib/subscription"
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/openai"
import Papa from "papaparse"
import type { SupabaseClient } from "@supabase/supabase-js"
import { findDuplicatesInMemory, findStrongMatchInMemory } from "@/lib/dedup"
import { IMPORT_FIELD_VALUES } from "@/lib/import-mapping"
import { createServiceClient } from "@/lib/supabase/server"

function normalizeIsoDate(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+.*)?$/)
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : usMatch
      ? { year: Number(usMatch[3]), month: Number(usMatch[1]), day: Number(usMatch[2]) }
      : null

  if (!parts) return null

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() + 1 !== parts.month ||
    date.getUTCDate() !== parts.day
  ) {
    return null
  }

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-")
}

export async function POST(request: Request) {
  let allowanceService: Awaited<ReturnType<typeof createServiceClient>> | null = null
  let allowanceUserId: string | null = null
  let reservedContactCount = 0
  try {
    const auth = await authenticateRequest("import")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const plan = await getUserPlan(user.id)
    const isFreeOnboardingImport = plan === "free"

    const formData = await request.formData()
    const file = formData.get("file") as File
    const mappingStr = formData.get("mapping") as string

    if (!file || !mappingStr) {
      return badRequestResponse("File and column mapping are required")
    }

    // Security: file size limit (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit" },
        { status: 413 }
      )
    }

    let mapping: Record<string, string>
    try {
      mapping = JSON.parse(mappingStr)
    } catch {
      return badRequestResponse("Invalid column mapping")
    }

    // Validate mapping values are only allowed fields
    const allowedFields = new Set<string>(IMPORT_FIELD_VALUES)
    for (const val of Object.values(mapping)) {
      if (!allowedFields.has(val)) {
        return badRequestResponse("Invalid mapping field")
      }
    }

    const csvText = await file.text()
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return badRequestResponse("Failed to parse CSV file")
    }

    const rows = parsed.data as Record<string, string>[]
    const contacts = rows
      .map((row) => {
        const contact: Record<string, string | boolean> = {}
        for (const [csvCol, field] of Object.entries(mapping)) {
          if (field === "skip" || !row[csvCol]) continue
          contact[field] = row[csvCol].trim()
        }
        if (!contact.name) return null
        // Build raw_note from user's notes column, or generate a minimal one
        const userNotes = (contact.notes as string) || ""
        const autoNote = `${contact.name}${contact.company ? ` at ${contact.company}` : ""}`
        const rawNote = userNotes || autoNote
        const lastContactDate = normalizeIsoDate(contact.last_contact_date as string | undefined)
        const scheduledFollowUp = normalizeIsoDate(contact.scheduled_follow_up as string | undefined)

        return {
          name: (contact.name as string) || null,
          email: (contact.email as string) || null,
          phone: (contact.phone as string) || null,
          company: (contact.company as string) || null,
          job_title: (contact.job_title as string) || null,
          website: (contact.website as string) || null,
          how_we_met: (contact.how_we_met as string) || null,
          next_steps: (contact.next_steps as string) || null,
          last_contact_date: lastContactDate,
          scheduled_follow_up: scheduledFollowUp,
          raw_note: rawNote,
          source: "csv_import",
          created_by: user.id,
          follow_up_needed: !!(contact.next_steps || scheduledFollowUp),
        }
      })
      .filter(Boolean)

    if (contacts.length === 0) {
      return badRequestResponse("No valid contacts found in CSV")
    }

    // Filter out contacts that already exist (dedup before insert).
    // Preload once and match in-memory — per-row DB lookups are O(rows *
    // existing_contacts) and time out on large imports.
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
    // twice in the CSV) are also deduped.
    const seen: typeof existingContacts = [...existingContacts]
    for (const c of contacts as NonNullable<(typeof contacts)[number]>[]) {
      const fields = {
        name: (c.name as string) || null,
        email: (c.email as string) || null,
        phone: (c.phone as string) || null,
        company: (c.company as string) || null,
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
        duplicates: [],
        message: `All ${skippedDupes} contacts already exist in your network.`,
      })
    }

    if (isFreeOnboardingImport) {
      allowanceService = await createServiceClient()
      allowanceUserId = user.id
      const { data: reservation, error: reservationError } = await allowanceService.rpc(
        "reserve_free_csv_contacts",
        { target_user_id: user.id, requested_count: deduped.length, limit_count: 5 }
      )
      if (reservationError) return errorResponse("Could not verify your onboarding import allowance")
      const allowance = reservation as { allowed?: boolean; remaining?: number } | null
      if (!allowance?.allowed && (allowance?.remaining || 0) === 0) {
        return forbiddenResponse("Your five free CSV imports are already used. Upgrade for unlimited importing.")
      }
      if (!allowance?.allowed) {
        const remaining = Math.max(0, allowance?.remaining || 0)
        return badRequestResponse(`Your free onboarding import has room for ${remaining} more contact${remaining === 1 ? "" : "s"}. Trim this CSV or upgrade for unlimited importing.`)
      }
      reservedContactCount = deduped.length
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert(deduped)
      .select()

    if (error) {
      if (reservedContactCount > 0 && allowanceService && allowanceUserId) {
        await allowanceService.rpc("refund_free_csv_contacts", {
          target_user_id: allowanceUserId,
          refund_count: reservedContactCount,
        })
        reservedContactCount = 0
      }
      console.error("Import error:", error)
      return errorResponse("Failed to import contacts")
    }

    reservedContactCount = 0

    // Generate embeddings after the response is sent. after() keeps the
    // serverless instance alive until this finishes, so a frozen/reclaimed
    // instance can't silently drop the embedding work or its Sentry events.
    after(async () => {
      try {
        await generateEmbeddingsBatch(data, supabase)
      } catch (err) {
        console.error("CSV import embedding generation failed:", err)
        Sentry.captureException(err, { tags: { background: "csv-import-embeddings" } })
      }
    })

    // Check each imported contact for duplicates among pre-existing contacts
    const duplicateSummary: {
      imported_contact: { id: string; name: string | null }
      existing_contact: { id: string; name: string | null }
      score: number
      reason: string
    }[] = []

    // Check against contacts that existed BEFORE this import, reusing the
    // list preloaded for dedup. It never contains this batch's rows, so
    // self- and in-batch matches can't occur.
    for (const imported of data) {
      const matches = findDuplicatesInMemory(
        {
          name: imported.name,
          email: imported.email,
          phone: imported.phone,
          company: imported.company,
        },
        existingContacts
      )
      for (const match of matches) {
        if (match.score >= 0.6) {
          duplicateSummary.push({
            imported_contact: { id: imported.id, name: imported.name },
            existing_contact: { id: match.contact.id, name: match.contact.name },
            score: match.score,
            reason: match.reason,
          })
        }
      }
    }

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")

    return NextResponse.json({
      success: true,
      imported: data.length,
      ...(duplicateSummary.length > 0 ? { duplicates: duplicateSummary } : {}),
    })
  } catch (error) {
    if (reservedContactCount > 0 && allowanceService && allowanceUserId) {
      try {
        await allowanceService.rpc("refund_free_csv_contacts", {
          target_user_id: allowanceUserId,
          refund_count: reservedContactCount,
        })
      } catch {
        // Preserve the original import failure.
      }
    }
    console.error("CSV import error:", error)
    return errorResponse("Internal server error")
  }
}

async function generateEmbeddingsBatch(
  contacts: { id: string; raw_note: string; name: string | null; company: string | null; job_title?: string | null; email?: string | null; how_we_met?: string | null; next_steps?: string | null }[],
  supabase: SupabaseClient
) {
  for (const contact of contacts) {
    const embeddingText = buildContactEmbeddingText({
      name: contact.name,
      company: contact.company,
      job_title: contact.job_title || null,
      email: contact.email || null,
      how_we_met: contact.how_we_met || null,
      next_steps: contact.next_steps || null,
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

// Preview endpoint for column mapping
export async function PUT(request: Request) {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return badRequestResponse("File is required")
    }

    // Security: file size limit (10MB)
    const MAX_PREVIEW_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_PREVIEW_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit" },
        { status: 413 }
      )
    }

    const csvText = await file.text()
    // header: true means parsed.data only contains data rows (the header row
    // is consumed into meta.fields), and skipEmptyLines drops the trailing
    // newline most CSV exports end with — so data.length IS the contact count.
    // The old count (csvText.split("\n").length - 1) counted that trailing
    // newline as an extra contact.
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
    const rows = parsed.data as Record<string, string>[]

    return NextResponse.json({
      headers: parsed.meta.fields || [],
      rows: rows.slice(0, 5),
      totalRows: rows.length,
    })
  } catch (error) {
    console.error("CSV preview error:", error)
    return errorResponse("Failed to parse CSV")
  }
}
