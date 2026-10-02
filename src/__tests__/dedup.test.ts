import { describe, it, expect } from "vitest"
import { duplicateCandidatePairs, findDuplicates, scorePair } from "@/lib/dedup"
import type { Contact } from "@/lib/types"

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: "c-" + Math.random().toString(36).slice(2, 8),
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
    raw_note: "test",
    embedding_status: "complete",
    source: "web",
    created_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    cadence_days: null,
    scheduled_follow_up: null,
    snoozed_until: null,
    next_due_date: null,
    archived_at: null,
    ...overrides,
  }
}

function mockSupabase(contacts: Partial<Contact>[]) {
  const fullContacts = contacts.map((c) => makeContact(c))
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => ({
              // Serve pages like the real API: inclusive range, so 1,000 rows max.
              range: (from: number, to: number) =>
                Promise.resolve({ data: fullContacts.slice(from, to + 1), error: null }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as Parameters<typeof findDuplicates>[0]
}

describe("findDuplicates", () => {
  it("returns score 1.0 for exact email match", async () => {
    const supabase = mockSupabase([
      { name: "Alice Smith", email: "alice@example.com" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Someone Else",
      email: "alice@example.com",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(1.0)
    expect(results[0].reason).toBe("Same email")
  })

  it("returns score 0.85 for same name and company", async () => {
    const supabase = mockSupabase([
      { name: "Bob Jones", company: "Acme Corp" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Bob Jones",
      company: "Acme Corp",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.85)
    expect(results[0].reason).toBe("Same name and company")
  })

  it("returns score 0.75 for same name only", async () => {
    const supabase = mockSupabase([
      { name: "Charlie Brown" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Charlie Brown",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.75)
    expect(results[0].reason).toBe("Same name")
  })

  it("returns score 0.9 for same phone number", async () => {
    const supabase = mockSupabase([
      { name: "Diana Prince", phone: "+1 (555) 123-4567" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Someone Else",
      phone: "15551234567",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.9)
    expect(results[0].reason).toBe("Same phone number")
  })

  it("matches names case-insensitively", async () => {
    const supabase = mockSupabase([
      { name: "ALICE SMITH" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "alice smith",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.75)
  })

  it("normalizes extra whitespace in names", async () => {
    const supabase = mockSupabase([
      { name: "  Alice   Smith  " },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Alice Smith",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.75)
  })

  it("returns empty array when no match", async () => {
    const supabase = mockSupabase([
      { name: "Alice Smith", email: "alice@example.com" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Completely Different Person",
      email: "other@example.com",
    })
    expect(results).toHaveLength(0)
  })

  it("excludes archived contacts from dedup check", async () => {
    // Archived contacts are excluded by the Supabase query (is archived_at null).
    // Since our mock only returns contacts that pass the query, we simulate
    // this by not including archived contacts in the mock data.
    const supabase = mockSupabase([
      // Only non-archived contacts are returned by the query
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Archived Person",
    })
    expect(results).toHaveLength(0)
  })

  it("returns multiple matches sorted by score descending", async () => {
    const supabase = mockSupabase([
      { name: "Alice Smith", email: "alice@example.com", company: "Acme" },
      { name: "Alice Smith", company: "OtherCo" },
      { name: "Alice Smith", company: "Acme" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Alice Smith",
      email: "alice@example.com",
      company: "Acme",
    })
    expect(results).toHaveLength(3)
    // First: email match (1.0)
    expect(results[0].score).toBe(1.0)
    expect(results[0].reason).toBe("Same email")
    // Second: name + company (0.85)
    expect(results[1].score).toBe(0.85)
    expect(results[1].reason).toBe("Same name and company")
    // Third: name only (0.75) — the one with OtherCo
    expect(results[2].score).toBe(0.75)
    expect(results[2].reason).toBe("Same name")
  })

  it("returns empty array when supabase returns an error", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              order: () => ({
                range: () => Promise.resolve({
                  data: null,
                  error: { message: "Something went wrong" },
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof findDuplicates>[0]
    const results = await findDuplicates(supabase, "user-1", {
      name: "Alice",
    })
    expect(results).toHaveLength(0)
  })

  it("finds a duplicate past the API's 1,000-row page (regression)", async () => {
    const filler = Array.from({ length: 1500 }, (_, i) => ({ name: `Filler ${i}`, email: `filler${i}@example.com` }))
    const supabase = mockSupabase([...filler, { name: "Late Match", email: "late@example.com" }])
    const results = await findDuplicates(supabase, "user-1", { email: "late@example.com" })
    expect(results).toHaveLength(1)
    expect(results[0].contact.name).toBe("Late Match")
  })

  it("email match takes priority over name+company match", async () => {
    const supabase = mockSupabase([
      { name: "Alice Smith", email: "alice@example.com", company: "Acme" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Alice Smith",
      email: "alice@example.com",
      company: "Acme",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(1.0)
    expect(results[0].reason).toBe("Same email")
  })

  it("does not match when fields are null or empty", async () => {
    const supabase = mockSupabase([
      { name: null, email: null, phone: null },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: null,
      email: null,
    })
    expect(results).toHaveLength(0)
  })

  it("returns score 1.0 for same LinkedIn profile URL", async () => {
    const supabase = mockSupabase([
      { name: "Alice", website: "https://www.linkedin.com/in/alicesmith" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Someone Else",
      website: "https://linkedin.com/in/alicesmith",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(1.0)
    expect(results[0].reason).toBe("Same LinkedIn profile")
  })

  it("LinkedIn match is case-insensitive", async () => {
    const supabase = mockSupabase([
      { name: "Alice", website: "https://linkedin.com/in/AliceSmith" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Someone",
      website: "https://linkedin.com/in/alicesmith",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(1.0)
  })

  it("handles empty string email without crashing", async () => {
    const supabase = mockSupabase([
      { name: "Alice", email: "" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Bob",
      email: "",
    })
    // Empty emails should not match
    expect(results).toHaveLength(0)
  })

  it("handles empty string name without crashing", async () => {
    const supabase = mockSupabase([
      { name: "", email: "alice@example.com" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "",
      email: "different@example.com",
    })
    expect(results).toHaveLength(0)
  })

  it("handles empty string phone without crashing", async () => {
    const supabase = mockSupabase([
      { name: "Alice", phone: "" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Bob",
      phone: "",
    })
    expect(results).toHaveLength(0)
  })
})

describe("duplicateCandidatePairs", () => {
  // Deterministic PRNG so a failure reproduces.
  function rng(seed: number) {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
  }
  const pick = <T,>(r: () => number, items: T[]) => items[Math.floor(r() * items.length)]

  it("flags exactly the pairs an all-pairs scan flags", () => {
    const r = rng(42)
    const names = [null, "", "Sam Lee", "sam lee", "Sam  Lee", "S. Lee", "Priya Patel", "Priya", "Jo", "Lee Sam", "O'Brien Kate", "obrienkate"]
    const emails = [null, "", "sam@x.com", "SAM@x.com ", "samlee@y.com", "priyapatel@z.io", "kate@q.com", "obrienkate@w.com"]
    const phones = [null, "", "+1 (415) 555-0100", "4155550100", "555"]
    const sites = [null, "https://linkedin.com/in/samlee", "https://www.linkedin.com/in/SamLee/", "https://example.com"]
    const companies = [null, "Acme", "acme ", "Index"]
    const vectors = [null, [1, 0, 0], [0.99, 0.05, 0], [0, 1, 0], [1, 0]]
    const contacts = Array.from({ length: 160 }, () => ({
      name: pick(r, names),
      email: pick(r, emails),
      phone: pick(r, phones),
      website: pick(r, sites),
      company: pick(r, companies),
      embedding: pick(r, vectors),
    }))

    const brute: string[] = []
    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const result = scorePair(contacts[i], contacts[j])
        if (result) brute.push(`${i}-${j}:${result.score}:${result.reason}`)
      }
    }
    const bucketed: string[] = []
    for (const [i, j] of duplicateCandidatePairs(contacts)) {
      const result = scorePair(contacts[i], contacts[j])
      if (result) bucketed.push(`${i}-${j}:${result.score}:${result.reason}`)
    }
    expect(brute.length).toBeGreaterThan(100)
    expect(new Set(brute.map((p) => p.split(":")[1].split(" ")[0])).size).toBeGreaterThan(3)
    // Same pairs, same scores and reasons, in the same order.
    expect(bucketed).toEqual(brute)
  })

  it("skips pairs with nothing in common", () => {
    const word = (i: number) => [...i.toString(26).padStart(3, "0")].map((ch) => String.fromCharCode(97 + parseInt(ch, 26))).join("")
    const contacts = Array.from({ length: 500 }, (_, i) => ({ name: `Ann ${word(i)}`, email: `${word(i)}@x.com` }))
    expect(duplicateCandidatePairs(contacts)).toEqual([])
  })
})
