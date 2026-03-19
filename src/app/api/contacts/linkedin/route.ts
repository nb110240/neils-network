import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkContactLimit, getUserPlan } from "@/lib/subscription"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const rl = await rateLimit(user.id, "create")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    // LinkedIn import is Pro only
    const plan = await getUserPlan(user.id)
    if (plan === "free") {
      return NextResponse.json(
        { message: "LinkedIn import is a Pro feature. Upgrade to import from LinkedIn." },
        { status: 403 }
      )
    }

    const { allowed, count, limit } = await checkContactLimit(user.id)
    if (!allowed) {
      return NextResponse.json(
        { message: `You've reached the ${limit}-contact limit. Upgrade for unlimited.` },
        { status: 403 }
      )
    }

    const { url, note } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ message: "LinkedIn URL is required" }, { status: 400 })
    }

    // Validate it's actually a LinkedIn URL
    const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i
    if (!linkedinRegex.test(url.trim())) {
      return NextResponse.json(
        { message: "Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/johndoe)" },
        { status: 400 }
      )
    }

    // Check for duplicate by LinkedIn URL
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("created_by", user.id)
      .ilike("website", `%${url.trim().replace(/\/$/, "")}%`)
      .single()

    if (existing) {
      return NextResponse.json(
        { message: "This LinkedIn contact already exists in your network", contactId: existing.id },
        { status: 409 }
      )
    }

    // Extract name from LinkedIn URL slug
    const slug = url.trim().replace(/\/$/, "").split("/").pop() || ""
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
        const extracted = await extractContactInfo(`${extractedName} - LinkedIn: ${url}\n${note}`)
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
      `Added from LinkedIn: ${url.trim()}`,
      name || extractedName,
      company ? `at ${company}` : null,
      note ? `\nNote: ${note}` : null,
    ].filter(Boolean).join(" ")

    // Generate embedding
    let embedding = null
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: "text-embedding-3-small", input: rawNote }),
        })
        if (res.ok) {
          const data = await res.json()
          embedding = data.data[0].embedding
        }
      } catch {
        // Non-critical
      }
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        name,
        company,
        job_title: jobTitle,
        website: url.trim(),
        how_we_met: howWeMet,
        next_steps: nextSteps,
        follow_up_needed: followUpNeeded,
        raw_note: rawNote,
        embedding,
        source: "linkedin",
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("LinkedIn contact insert error:", error)
      return NextResponse.json({ message: "Failed to create contact" }, { status: 500 })
    }

    return NextResponse.json({ success: true, contact })
  } catch (error) {
    console.error("LinkedIn import error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
