import { describe, it, expect } from "vitest"
import { CONTACT_COLUMNS } from "@/lib/contact-columns"
import type { Contact } from "@/lib/types"

// ─── Drift test: CONTACT_COLUMNS vs the Contact type ───
// CONTACT_COLUMNS is a hand-maintained string. If the Contact interface gains
// or loses a field, this fixture stops compiling (Record<keyof Contact, true>
// requires exactly the interface's keys), forcing the column list to be
// updated in the same change instead of silently drifting.
const contactKeys: Record<keyof Contact, true> = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  job_title: true,
  website: true,
  how_we_met: true,
  next_steps: true,
  follow_up_needed: true,
  last_contact_date: true,
  raw_note: true,
  embedding: true,
  embedding_status: true,
  source: true,
  created_by: true,
  cadence_days: true,
  scheduled_follow_up: true,
  snoozed_until: true,
  next_due_date: true,
  created_at: true,
  updated_at: true,
  archived_at: true,
}

describe("CONTACT_COLUMNS drift against the Contact type", () => {
  it("selects every Contact field except embedding, plus event_id", () => {
    const columns = CONTACT_COLUMNS.split(",").map((c) => c.trim())

    // The 1536-dim embedding vector is deliberately excluded — it's the whole
    // point of CONTACT_COLUMNS (see src/lib/contact-columns.ts).
    // event_id is a real DB column read by the graph page (graph/page.tsx casts
    // the API rows to include it) but is deliberately absent from the Contact
    // TS interface — so it's added on top of the type-derived keys here.
    const expected = Object.keys(contactKeys)
      .filter((key) => key !== "embedding")
      .concat("event_id")

    expect([...columns].sort()).toEqual([...expected].sort())
  })

  it("has no duplicate columns", () => {
    const columns = CONTACT_COLUMNS.split(",").map((c) => c.trim())
    expect(new Set(columns).size).toBe(columns.length)
  })
})
