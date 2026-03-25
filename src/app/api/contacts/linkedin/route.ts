import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, forbiddenResponse, errorResponse } from "@/lib/api-utils"
import { checkContactLimit, getUserPlan } from "@/lib/subscription"
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/openai"
import { findDuplicates } from "@/lib/dedup"

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("create")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    // LinkedIn import is Pro only
    const plan = await getUserPlan(user.id)
    if (plan === "free") {
      return forbiddenResponse("LinkedIn import is a Pro feature. Upgrade to import from LinkedIn.")
    }

    const { allowed, count, limit } = await checkContactLimit(user.id)
    if (!allowed) {
      return forbiddenResponse(`You've reached the ${limit}-contact limit. Upgrade for unlimited.`)
    }

    const { url, note } = await request.json()

    if (!url || typeof url !== "string") {
      return badRequestResponse("LinkedIn URL is required")
    }

    // Validate it's actually a LinkedIn URL (strip tracking params first)
    let cleanUrl = url.trim()
    try {
      const parsed = new URL(cleanUrl)
      if (!parsed.hostname.match(/^(www\.)?linkedin\.com$/i)) {
        return badRequestResponse("Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/johndoe)")
      }
      // Strip query params and hash — keep only the path
      cleanUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "")
    } catch {
      return badRequestResponse("Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/johndoe)")
    }

    const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+$/i
    if (!linkedinRegex.test(cleanUrl)) {
      return badRequestResponse("Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/johndoe)")
    }

    // Check for duplicate by LinkedIn URL (only among active contacts)
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("created_by", user.id)
      .is("archived_at", null)
      .ilike("website", `%${cleanUrl.replace(/\/$/, "")}%`)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "This LinkedIn contact already exists in your network", contactId: existing.id },
        { status: 409 }
      )
    }

    // Extract name from LinkedIn URL slug
    const slug = cleanUrl.replace(/\/$/, "").split("/").pop() || ""
    const nameParts = slug
      .replace(/-\d+$/, "") // remove trailing numbers like -123
      .split("-")
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    const extractedName = nameParts.join(" ")

    // If user provided additional context, use AI to extract more info
    let name = extractedName || null
    let company = null
    let jobTitle = null
    let howWeMet = "Added from LinkedIn"
    let nextSteps = null
    let followUpNeeded = false

    if (note && typeof note === "string" && note.trim().length > 3) {
      try {
        const { extractContactInfo } = await import("@/lib/extract-contact")
        const extracted = await extractContactInfo(`${extractedName} - LinkedIn: ${cleanUrl}\n${note}`)
        name = (extracted.name as string) || extractedName
        company = extracted.company as string | null
        jobTitle = extracted.job_title as string | null
        howWeMet = (extracted.how_we_met as string) || "Added from LinkedIn"
        nextSteps = extracted.next_steps as string | null
        followUpNeeded = (extracted.follow_up_needed as boolean) || false
      } catch {
        // AI extraction failed, use basic info
      }
    }

    const rawNote = [
      `Added from LinkedIn: ${cleanUrl}`,
      name || extractedName,
      company ? `at ${company}` : null,
      note ? `\nNote: ${note}` : null,
    ].filter(Boolean).join(" ")

    // Broader dedup check (name, email, phone, company, LinkedIn URL)
    const duplicates = (await findDuplicates(supabase, user.id, {
      name,
      company,
      website: cleanUrl,
    })).filter((d) => d.score >= 0.6)

    // Generate embedding using centralized utility
    const embeddingText = buildContactEmbeddingText({
      name,
      company,
      job_title: jobTitle,
      raw_note: rawNote,
    })
    const embedding = await generateEmbedding(embeddingText)

    const embeddingStatus = embedding ? "complete" : "failed"

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        name,
        company,
        job_title: jobTitle,
        website: cleanUrl,
        how_we_met: howWeMet,
        next_steps: nextSteps,
        follow_up_needed: followUpNeeded,
        raw_note: rawNote,
        embedding,
        embedding_status: embeddingStatus,
        source: "linkedin",
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("LinkedIn contact insert error:", error)
      return errorResponse("Failed to create contact")
    }

    return NextResponse.json({
      success: true,
      contact,
      ...(duplicates.length > 0 ? { duplicates } : {}),
    })
  } catch (error) {
    console.error("LinkedIn import error:", error)
    return errorResponse("Internal server error")
  }
}
