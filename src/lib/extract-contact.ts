const SYSTEM_PROMPT = `You are an expert at extracting contact information from casual, messy networking notes. People write these quickly after meeting someone — often informal, incomplete, and without labeling fields.

Your job: extract as much structured data as possible, even when fields aren't explicitly named.

Return a JSON object with these exact fields (use null for missing values):
- name (string): The person's full name. Look for proper nouns, "met [Name]", first+last names, etc.
- email (string): Email address if mentioned
- phone (string): Phone number if mentioned
- company (string): Their company/organization. Look for "at [Company]", "from [Company]", "works at", or any organization name near their role.
- job_title (string): Their role/title. Look for "is a [role]", "VP of", "founder", "CEO", "engineer", "works in [department]", etc. Even informal descriptions like "does sales" should become "Sales".
- website (string): URL or LinkedIn URL if mentioned
- how_we_met (string): Context of how they met. Look for event names, locations, "at the [event]", "introduced by", "conference", "meetup", "dinner", mutual connections, etc.
- next_steps (string): Any follow-up actions. Look for "should", "need to", "follow up", "send", "grab coffee", "schedule", "intro to", "connect them with", etc.
- follow_up_needed (boolean): true if there's any implied or explicit follow-up action
- last_contact_date (string|null): ISO date (YYYY-MM-DD) if a specific date is mentioned. Convert relative dates like "yesterday", "last Tuesday", "Jan 15" to ISO format using today's date. null if no date mentioned.

IMPORTANT RULES:
1. Be aggressive about extraction — it's better to extract something imperfect than miss it
2. If someone says "she runs a fintech startup called Plaid" → company: "Plaid", job_title: "Founder" (infer founder from "runs")
3. If someone says "met at TechCrunch" → how_we_met: "TechCrunch" (conference/event implied)
4. If someone says "should grab coffee" → follow_up_needed: true, next_steps: "Grab coffee"
5. If someone says "he's in product at Google" → company: "Google", job_title: "Product"
6. Today's date for relative date conversion: ${new Date().toISOString().split("T")[0]}`

async function extractWithOpenAI(raw_note: string): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: raw_note },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  })

  if (!response.ok) throw new Error(`OpenAI failed: ${response.status}`)

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}

async function extractWithGemini(raw_note: string): Promise<Record<string, unknown>> {
  const googleKey = process.env.GOOGLE_AI_API_KEY
  if (!googleKey) throw new Error("No fallback model configured")

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${googleKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: raw_note }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  )

  if (!response.ok) throw new Error(`Gemini failed: ${response.status}`)

  const data = await response.json()
  const text = data.candidates[0].content.parts[0].text

  return JSON.parse(text)
}

export async function extractContactInfo(raw_note: string): Promise<Record<string, unknown>> {
  const { validateExtraction } = await import("@/lib/validate-extraction")
  let extracted: Record<string, unknown>

  try {
    // Primary: GPT-4o-mini (fast, cheap)
    extracted = await extractWithOpenAI(raw_note)
  } catch (primaryError) {
    console.error("Primary extraction failed:", primaryError)
    try {
      // Fallback: Gemini 2.5 Flash
      extracted = await extractWithGemini(raw_note)
    } catch (fallbackError) {
      console.error("Fallback extraction failed:", fallbackError)
      // Last resort: return basic structure with just the raw note
      return {
        name: null,
        email: null,
        phone: null,
        company: null,
        job_title: null,
        website: null,
        how_we_met: null,
        next_steps: null,
        follow_up_needed: false,
        last_contact_date: null,
      }
    }
  }

  // Normalize nulls and empty values
  const fields = ["name", "email", "phone", "company", "job_title", "website", "how_we_met", "next_steps", "last_contact_date"]
  for (const f of fields) {
    if (extracted[f] === "N/A" || extracted[f] === "" || extracted[f] === undefined || extracted[f] === "null" || extracted[f] === "unknown") {
      extracted[f] = null
    }
    if (typeof extracted[f] === "string") {
      extracted[f] = (extracted[f] as string).trim()
    }
  }

  // Ensure follow_up_needed is boolean
  if (typeof extracted.follow_up_needed !== "boolean") {
    extracted.follow_up_needed = !!extracted.next_steps
  }

  // Validate AI-extracted fields — strip hallucinated emails, phones, URLs
  return validateExtraction(extracted)
}
