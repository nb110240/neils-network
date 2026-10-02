import { describe, it, expect, vi } from "vitest"
import { createMockSupabase } from "../helpers/mock-supabase"
import { postRequest } from "../helpers/mock-request"
import { buildNextMoves, DASHBOARD_MOVE_LIMIT, relationshipMoves, type MoveContact } from "@/lib/next-moves"
import type { Commitment } from "@/lib/types"

const h = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof import("../helpers/mock-supabase").createMockSupabase> | null,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.supabase),
  createServiceClient: vi.fn(async () => h.supabase),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))

const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock("next/cache", () => ({ revalidatePath }))

import { POST as snooze } from "@/app/api/contacts/[id]/snooze/route"

/**
 * The dashboard's "Next moves", /moves, and /reach-out all render the output of
 * buildNextMoves. This walks a founder's real week through all three views and
 * through the snooze action they take from the list.
 */
describe("Next moves / Reach Out flow", () => {
  const now = Date.now()
  const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString()
  const today = new Date(now).toISOString().slice(0, 10)

  const ids = {
    investor: "11111111-1111-4111-8111-111111111111",
    advisor: "22222222-2222-4222-8222-222222222222",
    oldColleague: "33333333-3333-4333-8333-333333333333",
    newIntro: "44444444-4444-4444-8444-444444444444",
    friend: "55555555-5555-4555-8555-555555555555",
  }

  function makeContact(overrides: Partial<MoveContact>): MoveContact {
    return {
      id: ids.friend,
      name: "Test",
      company: null,
      next_steps: null,
      follow_up_needed: false,
      next_due_date: null,
      snoozed_until: null,
      last_contact_date: daysAgo(3),
      cadence_days: null,
      created_at: daysAgo(400),
      ...overrides,
    }
  }

  const contacts: MoveContact[] = [
    // Met yesterday, AI flagged a follow-up and wrote next steps.
    makeContact({ id: ids.newIntro, name: "Priya Shah", company: "Seedcamp", follow_up_needed: true, next_steps: "Send the deck", last_contact_date: daysAgo(1), created_at: daysAgo(1) }),
    // Owes nothing, but monthly cadence lapsed long ago.
    makeContact({ id: ids.advisor, name: "Marcus Lee", cadence_days: 30, last_contact_date: daysAgo(70) }),
    // No cadence, silent for half a year.
    makeContact({ id: ids.oldColleague, name: "Dana Wu", last_contact_date: daysAgo(190) }),
    // Has an open promise AND a follow-up flag: should appear once, via the promise.
    makeContact({ id: ids.investor, name: "Alex Kim", company: "Northstar Ventures", follow_up_needed: true, last_contact_date: daysAgo(10) }),
    // Healthy, unflagged: nothing to do.
    makeContact({ id: ids.friend, name: "Sam Ortiz", last_contact_date: daysAgo(4) }),
  ]

  const commitments: Commitment[] = [{
    id: "c1",
    user_id: "u1",
    contact_id: ids.investor,
    source_activity_id: null,
    review_id: null,
    direction: "user_owes",
    title: "Send Q3 metrics",
    details: null,
    due_at: daysAgo(2),
    status: "open",
    snoozed_until: null,
    evidence: null,
    confidence: 0.9,
    priority: 80,
    completed_at: null,
    created_at: daysAgo(10),
    updated_at: daysAgo(10),
  }]

  it("ranks one list and every view agrees on it", () => {
    const all = buildNextMoves({ contacts, commitments, reviews: [], nowMs: now })
    const dashboard = all.slice(0, DASHBOARD_MOVE_LIMIT)
    const reachOut = relationshipMoves(all)

    expect(all.map((move) => move.contactName)).toEqual([
      "Alex Kim", // overdue promise
      "Priya Shah", // flagged follow-up after a fresh meeting
      "Dana Wu", // cold, oldest first
      "Marcus Lee", // past cadence
    ])
    expect(all[0].kind).toBe("commitment")
    expect(all.filter((move) => move.contactId === ids.investor)).toHaveLength(1)
    expect(all.some((move) => move.contactId === ids.friend)).toBe(false)

    expect(dashboard).toEqual(all)
    expect(reachOut.map((move) => move.contactName)).toEqual(["Priya Shah", "Dana Wu", "Marcus Lee"])
    expect(reachOut[0].title).toBe("Send the deck")
  })

  it("snoozing a contact from the list removes them from the dashboard, /moves, and /reach-out", async () => {
    h.supabase = createMockSupabase({
      authUser: { id: "u1" },
      queryResult: { data: { id: ids.oldColleague }, error: null },
    })
    const res = await snooze(
      postRequest(`http://localhost/api/contacts/${ids.oldColleague}/snooze`, { days: 7 }),
      { params: Promise.resolve({ id: ids.oldColleague }) },
    )
    expect(res.status).toBe(200)
    const { snoozed_until } = await res.json()
    expect(snoozed_until >= today).toBe(true)

    for (const path of ["/dashboard", "/reach-out", "/moves"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path)
    }

    const after = buildNextMoves({
      contacts: contacts.map((c) => (c.id === ids.oldColleague ? { ...c, snoozed_until } : c)),
      commitments,
      reviews: [],
      nowMs: now,
    })
    expect(after.some((move) => move.contactId === ids.oldColleague)).toBe(false)
    expect(relationshipMoves(after).map((move) => move.contactName)).toEqual(["Priya Shah", "Marcus Lee"])
  })
})
