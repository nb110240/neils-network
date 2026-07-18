// ─── Centralized OpenAI utilities ───
//
// Embedding generation with:
// - Input length validation (10KB max)
// - 30-second timeout
// - 2x retry with exponential backoff
// - Consistent error handling
//
// Contact extraction stays in extract-contact.ts (domain-specific + Gemini fallback).

const EMBEDDING_MODEL = "text-embedding-3-small"
const MAX_INPUT_LENGTH = 10_000 // ~10KB
const TIMEOUT_MS = 30_000
const MAX_RETRIES = 2

interface EmbeddingResult {
  embedding: number[]
  model: string
}

interface StructuredOutputOptions {
  name: string
  schema: Record<string, unknown>
  system: string
  user: string
  model?: string
  maxTokens?: number
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generate schema-constrained JSON with the same timeout and retry posture as
 * embeddings. Callers still validate the parsed value with their domain Zod
 * schema because schema adherence does not guarantee factual correctness.
 */
export async function generateStructuredOutput<T>({
  name,
  schema,
  system,
  user,
  model = process.env.OPENAI_ACTION_MODEL || "gpt-4o-mini",
  maxTokens = 1200,
}: StructuredOutputOptions): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("AI analysis is not configured")

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            store: false,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name, strict: true, schema },
            },
            temperature: 0.2,
            max_tokens: maxTokens,
          }),
        },
        TIMEOUT_MS
      )

      if (response.status === 429 && attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt + 1))
        continue
      }

      if (!response.ok) {
        throw new Error(`AI analysis failed (${response.status})`)
      }

      const data = await response.json()
      const message = data.choices?.[0]?.message
      if (message?.refusal) throw new Error("AI analysis was unable to process these notes")
      if (!message?.content) throw new Error("AI analysis returned no result")
      return JSON.parse(message.content) as T
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt + 1))
        continue
      }
      throw error
    }
  }

  throw new Error("AI analysis failed")
}

/**
 * Generate an embedding for the given text.
 * Returns the embedding vector, or null if generation fails after retries.
 *
 * @param text - Text to embed (truncated to MAX_INPUT_LENGTH)
 * @returns embedding vector or null
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  // Truncate oversized input
  const input = text.length > MAX_INPUT_LENGTH
    ? text.slice(0, MAX_INPUT_LENGTH)
    : text

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        "https://api.openai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
        },
        TIMEOUT_MS
      )

      if (response.status === 429 && attempt < MAX_RETRIES) {
        // Rate limited — backoff and retry
        await sleep(1000 * (attempt + 1))
        continue
      }

      if (!response.ok) {
        console.error(`OpenAI embedding error (${response.status}):`, await response.text())
        return null
      }

      const data = await response.json()
      return data.data[0].embedding
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt + 1))
        continue
      }
      console.error("OpenAI embedding failed after retries:", err)
      return null
    }
  }

  return null
}

/**
 * Build the embedding text for a contact from its fields.
 * Centralizes the text construction so all embedding paths are consistent.
 * Includes ALL searchable fields so semantic search can match on any contact info.
 */
export function buildContactEmbeddingText(fields: {
  name?: string | null
  company?: string | null
  job_title?: string | null
  email?: string | null
  how_we_met?: string | null
  next_steps?: string | null
  raw_note: string
}): string {
  return [fields.name, fields.company, fields.job_title, fields.email, fields.how_we_met, fields.next_steps, fields.raw_note]
    .filter(Boolean)
    .join(" ")
}
