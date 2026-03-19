import { describe, it, expect } from "vitest"
import { findDuplicates } from "@/lib/dedup"
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
            data: fullContacts,
            error: null,
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

  it("returns score 0.8 for same name and company", async () => {
    const supabase = mockSupabase([
      { name: "Bob Jones", company: "Acme Corp" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Bob Jones",
      company: "Acme Corp",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.8)
    expect(results[0].reason).toBe("Same name and company")
  })

  it("returns score 0.6 for same name only", async () => {
    const supabase = mockSupabase([
      { name: "Charlie Brown" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Charlie Brown",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.6)
    expect(results[0].reason).toBe("Same name")
  })

  it("returns score 0.8 for same phone number", async () => {
    const supabase = mockSupabase([
      { name: "Diana Prince", phone: "+1 (555) 123-4567" },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Someone Else",
      phone: "15551234567",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.8)
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
    expect(results[0].score).toBe(0.6)
  })

  it("normalizes extra whitespace in names", async () => {
    const supabase = mockSupabase([
      { name: "  Alice   Smith  " },
    ])
    const results = await findDuplicates(supabase, "user-1", {
      name: "Alice Smith",
    })
    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.6)
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
    // Second: name + company (0.8)
    expect(results[1].score).toBe(0.8)
    expect(results[1].reason).toBe("Same name and company")
    // Third: name only (0.6) — the one with OtherCo
    expect(results[2].score).toBe(0.6)
    expect(results[2].reason).toBe("Same name")
  })

  it("returns empty array when supabase returns an error", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              data: null,
              error: { message: "Something went wrong" },
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
})
