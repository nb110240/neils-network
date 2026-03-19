// Run with: npx tsx scripts/re-embed.ts
// Re-embeds all contacts using text-embedding-3-small
// Requires OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { config } from "dotenv"
config({ path: ".env.local" })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_KEY = process.env.OPENAI_API_KEY!

const BATCH_SIZE = 50 // OpenAI supports up to 2048 inputs per request

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.method === "PATCH" ? "return=minimal" : "return=representation",
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase error: ${res.status} ${text}`)
  }
  if (options.method === "PATCH") return null
  return res.json()
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding)
}

async function main() {
  console.log("Fetching all contacts...")

  const contacts = await supabaseFetch(
    "/contacts?select=id,name,company,raw_note&order=created_at.asc"
  )

  console.log(`Found ${contacts.length} contacts to re-embed.\n`)

  if (contacts.length === 0) {
    console.log("Nothing to do.")
    return
  }

  let processed = 0

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE)
    const texts = batch.map(
      (c: { name: string; company: string; raw_note: string }) =>
        `${c.name || ""} ${c.company || ""} ${c.raw_note}`
    )

    console.log(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contacts.length / BATCH_SIZE)} (${batch.length} contacts)...`)

    const embeddings = await getEmbeddings(texts)

    for (let j = 0; j < batch.length; j++) {
      await supabaseFetch(`/contacts?id=eq.${batch[j].id}`, {
        method: "PATCH",
        body: JSON.stringify({ embedding: embeddings[j] }),
      })
    }

    processed += batch.length
    console.log(`  Done. ${processed}/${contacts.length} complete.`)
  }

  console.log(`\nAll ${contacts.length} contacts re-embedded with text-embedding-3-small.`)
}

main().catch((err) => {
  console.error("Failed:", err.message)
  process.exit(1)
})
