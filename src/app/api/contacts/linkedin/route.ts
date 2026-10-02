import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, forbiddenResponse, errorResponse } from "@/lib/api-utils"
import { checkContactLimit, getUserPlan } from "@/lib/subscription"
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/openai"
import { findDuplicates, findStrongMatch } from "@/lib/dedup"
import { nameFromLinkedInSlug, normalizeLinkedInProfileUrl } from "@/lib/linkedin"

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

    // Accepts country subdomains (uk.linkedin.com), the mobile host, missing
    // scheme and tracking params; stores the canonical www URL.
    const profile = normalizeLinkedInProfileUrl(url)
    if (!profile) {
      return badRequestResponse("Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/johndoe)")
    }
    const cleanUrl = profile.url
    const slug = profile.slug

    // Check for duplicate by LinkedIn slug (only among active contacts).
    // Matches any stored host variant (linkedin.com, www., uk.) and is
    // anchored at the end so /in/john does not match /in/johnsmith.
    // limit(1).maybeSingle(): .single() errored when two rows matched, and
    // the error was read as "no duplicate".
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("created_by", user.id)
      .is("archived_at", null)
      // Escape LIKE wildcards: slugs can contain "_" and "%XX" escapes.
      .ilike("website", `%linkedin.com/in/${slug.replace(/[\\%_]/g, "\\$&")}`)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "This LinkedIn contact already exists in your network", contactId: existing.id },
        { status: 409 }
      )
    }

    // Extract name from LinkedIn URL slug
    const extractedName = nameFromLinkedInSlug(profile.rawSlug)

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

    // Block duplicate creation — if strong match found, return 409
    const strongMatch = await findStrongMatch(supabase, user.id, {
      name,
      company,
      website: cleanUrl,
    })
    if (strongMatch) {
      return NextResponse.json({
        error: "This person is already in your network.",
        contactId: strongMatch.contactId,
      }, { status: 409 })
    }

    // Generate embedding using centralized utility
    const embeddingText = buildContactEmbeddingText({
      name,
      company,
      job_title: jobTitle,
      how_we_met: howWeMet,
      next_steps: nextSteps,
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

    revalidatePath("/dashboard")
    revalidatePath("/reach-out")
    revalidatePath("/contacts")

    return NextResponse.json({
      success: true,
      contact,
    })
  } catch (error) {
    console.error("LinkedIn import error:", error)
    return errorResponse("Internal server error")
  }
}
