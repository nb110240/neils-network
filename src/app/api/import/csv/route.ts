import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserPlan, getPlanLimits } from "@/lib/subscription"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import Papa from "papaparse"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Rate limit: 5 imports per hour (heavy operation)
    const rl = await rateLimit(user.id, "import")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many imports. Please wait before trying again." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const plan = await getUserPlan(user.id)
    const limits = getPlanLimits(plan)
    if (!limits.canImport) {
      return NextResponse.json(
        { message: "Import is a Pro feature. Upgrade to import contacts." },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const mappingStr = formData.get("mapping") as string

    if (!file || !mappingStr) {
      return NextResponse.json(
        { message: "File and column mapping are required" },
        { status: 400 }
      )
    }

    // Security: file size limit (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "File exceeds 10MB limit" },
        { status: 413 }
      )
    }

    let mapping: Record<string, string>
    try {
      mapping = JSON.parse(mappingStr)
    } catch {
      return NextResponse.json(
        { message: "Invalid column mapping" },
        { status: 400 }
      )
    }

    // Validate mapping values are only allowed fields
    const allowedFields = new Set(["skip", "name", "email", "phone", "company", "job_title", "website", "how_we_met"])
    for (const val of Object.values(mapping)) {
      if (!allowedFields.has(val)) {
        return NextResponse.json(
          { message: "Invalid mapping field" },
          { status: 400 }
        )
      }
    }

    const csvText = await file.text()
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json(
        { message: "Failed to parse CSV file" },
        { status: 400 }
      )
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
        return {
          name: (contact.name as string) || null,
          email: (contact.email as string) || null,
          phone: (contact.phone as string) || null,
          company: (contact.company as string) || null,
          job_title: (contact.job_title as string) || null,
          website: (contact.website as string) || null,
          how_we_met: (contact.how_we_met as string) || null,
          raw_note: `Imported from CSV. ${contact.name}${contact.company ? ` at ${contact.company}` : ""}`,
          source: "csv_import",
          created_by: user.id,
          follow_up_needed: false,
        }
      })
      .filter(Boolean)

    if (contacts.length === 0) {
      return NextResponse.json(
        { message: "No valid contacts found in CSV" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert(contacts)
      .select()

    if (error) {
      console.error("Import error:", error)
      return NextResponse.json(
        { message: "Failed to import contacts" },
        { status: 500 }
      )
    }

    // Generate embeddings in batch (fire and forget for speed)
    generateEmbeddingsBatch(data, supabase).catch(console.error)

    return NextResponse.json({
      success: true,
      imported: data.length,
    })
  } catch (error) {
    console.error("CSV import error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

async function generateEmbeddingsBatch(
  contacts: { id: string; raw_note: string; name: string | null; company: string | null }[],
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>
) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return

  const texts = contacts.map(
    (c) => `${c.name || ""} ${c.company || ""} ${c.raw_note}`
  )

  // OpenAI supports batch embedding
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  })

  if (!response.ok) return

  const data = await response.json()
  const embeddings = data.data as { embedding: number[]; index: number }[]

  for (const item of embeddings) {
    const contact = contacts[item.index]
    await supabase
      .from("contacts")
      .update({ embedding: item.embedding })
      .eq("id", contact.id)
  }
}

// Preview endpoint for column mapping
export async function PUT(request: Request) {
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

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ message: "File is required" }, { status: 400 })
    }

    // Security: file size limit (10MB)
    const MAX_PREVIEW_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_PREVIEW_SIZE) {
      return NextResponse.json(
        { message: "File exceeds 10MB limit" },
        { status: 413 }
      )
    }

    const csvText = await file.text()
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, preview: 5 })

    return NextResponse.json({
      headers: parsed.meta.fields || [],
      rows: parsed.data,
      totalRows: csvText.split("\n").length - 1,
    })
  } catch (error) {
    console.error("CSV preview error:", error)
    return NextResponse.json(
      { message: "Failed to parse CSV" },
      { status: 500 }
    )
  }
}
