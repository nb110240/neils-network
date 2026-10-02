import { describe, expect, it } from "vitest"
import { buildNextMoves, DASHBOARD_MOVE_LIMIT, relationshipMoves, type MoveContact } from "@/lib/next-moves"
import type { AfterCallReview, Commitment, IntroRequest } from "@/lib/types"

const NOW = new Date("2026-07-17T12:00:00.000Z").getTime()

function contact(overrides: Partial<MoveContact> = {}): MoveContact {
  return {
    id: "contact-1",
    name: "Avery",
    company: "Northstar",
    next_steps: null,
    follow_up_needed: false,
    next_due_date: null,
    snoozed_until: null,
    last_contact_date: "2026-07-01",
    cadence_days: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function commitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: "commitment-1",
    user_id: "user-1",
    contact_id: "contact-1",
    source_activity_id: null,
    review_id: null,
    direction: "user_owes",
    title: "Send the metrics",
    details: null,
    due_at: "2026-07-16T12:00:00.000Z",
    status: "open",
    snoozed_until: null,
    evidence: null,
    confidence: 0.9,
    priority: 80,
    completed_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

function review(overrides: Partial<AfterCallReview> = {}): AfterCallReview {
  return {
    id: "review-1",
    user_id: "user-1",
    contact_id: "contact-2",
    source: "manual",
    external_source_id: null,
    title: "Investor call",
    occurred_at: "2026-07-17T10:00:00.000Z",
    raw_text: "Notes",
    content_hash: "hash",
    summary: "Summary",
    proposed_contact_patch: {},
    proposed_commitments: [],
    proposed_follow_up: null,
    status: "pending",
    reviewed_at: null,
    created_at: "2026-07-17T10:00:00.000Z",
    updated_at: "2026-07-17T10:00:00.000Z",
    ...overrides,
  }
}

function intro(overrides: Partial<IntroRequest> = {}): IntroRequest {
  return {
    id: "intro-1",
    user_id: "user-1",
    target_contact_id: "contact-3",
    connector_contact_id: "contact-4",
    status: "requested",
    reason: "Fundraising fit",
    path_evidence: "Worked together",
    path_confidence: "verified",
    strength_score: 90,
    draft_message: "Would you introduce us?",
    next_follow_up_at: "2026-07-16T12:00:00.000Z",
    requested_at: "2026-07-10T12:00:00.000Z",
    accepted_at: null,
    introduced_at: null,
    meeting_booked_at: null,
    closed_at: null,
    created_at: "2026-07-10T12:00:00.000Z",
    updated_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  }
}

describe("buildNextMoves", () => {
  it("uses deterministic urgency ordering across commitments, reviews, and follow-ups", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      contacts: [
        contact(),
        contact({ id: "contact-2", name: "Blair" }),
        contact({ id: "contact-3", name: "Casey", follow_up_needed: true }),
      ],
      commitments: [
        commitment({ id: "unscheduled", due_at: null }),
        commitment({ id: "due", contact_id: "contact-4", due_at: "2026-07-17T12:00:00.000Z" }),
        commitment({ id: "overdue", contact_id: "contact-5", due_at: "2026-07-14T12:00:00.000Z" }),
      ],
      reviews: [review()],
    })

    expect(moves.map((move) => move.id)).toEqual([
      "commitment:overdue",
      "review:review-1",
      "commitment:due",
      "commitment:unscheduled",
      "follow-up:contact-3",
    ])
  })

  it("excludes a future-snoozed commitment and a future-snoozed contact", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      contacts: [contact({ follow_up_needed: true, snoozed_until: "2026-07-20" })],
      commitments: [commitment({ status: "snoozed", snoozed_until: "2026-07-20T12:00:00.000Z" })],
      reviews: [],
    })

    expect(moves).toEqual([])
  })

  it("deduplicates contact-level follow-ups when a commitment or pending review already owns the move", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      contacts: [
        contact({ follow_up_needed: true }),
        contact({ id: "contact-2", follow_up_needed: true }),
      ],
      commitments: [commitment()],
      reviews: [review()],
    })

    expect(moves.map((move) => move.id)).toEqual([
      "commitment:commitment-1",
      "review:review-1",
    ])
    expect(moves.filter((move) => move.kind === "follow_up")).toHaveLength(0)
  })

  it("adds stalled warm introductions while hiding completed pipeline records", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      contacts: [contact({ id: "contact-3", name: "Alex Investor", follow_up_needed: true })],
      commitments: [],
      reviews: [],
      introRequests: [intro(), intro({ id: "booked", status: "meeting_booked" })],
    })

    expect(moves).toHaveLength(1)
    expect(moves[0]).toEqual(expect.objectContaining({
      id: "intro:intro-1",
      kind: "intro",
      contactName: "Alex Investor",
      href: "/intros#intro-intro-1",
    }))
  })
})

function daysBefore(days: number): string {
  return new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString()
}

describe("buildNextMoves relationship rules (shared by dashboard, /moves, /reach-out)", () => {
  it("excludes snoozed contacts from every relationship signal, including follow-up flags", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      commitments: [],
      reviews: [],
      contacts: [
        contact({ id: "flagged", follow_up_needed: true, snoozed_until: "2026-07-17" }),
        contact({ id: "cold", last_contact_date: daysBefore(200), snoozed_until: "2026-08-01" }),
        contact({ id: "scheduled", next_due_date: "2026-07-10", snoozed_until: "2026-07-18" }),
        contact({ id: "expired-snooze", follow_up_needed: true, snoozed_until: "2026-07-16" }),
      ],
    })

    expect(moves.map((move) => move.contactId)).toEqual(["expired-snooze"])
  })

  it("gives each contact one move with its strongest reason", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      commitments: [],
      reviews: [],
      contacts: [
        // Scheduled AND flagged AND cold: scheduled wins.
        contact({ id: "a", next_due_date: "2026-07-15", follow_up_needed: true, last_contact_date: daysBefore(200) }),
        // Flagged AND cold: flagged wins.
        contact({ id: "b", follow_up_needed: true, last_contact_date: daysBefore(150) }),
      ],
    })

    expect(moves).toHaveLength(2)
    expect(moves.map((move) => [move.contactId, move.signal])).toEqual([
      ["a", "scheduled"],
      ["b", "flagged"],
    ])
    expect(new Set(moves.map((move) => move.contactId)).size).toBe(moves.length)
  })

  it("keeps healthy follow-up flags but ranks them after flags on slipping relationships", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      commitments: [],
      reviews: [],
      contacts: [
        contact({ id: "fresh-meeting", follow_up_needed: true, last_contact_date: daysBefore(1) }),
        contact({ id: "slipping", follow_up_needed: true, last_contact_date: daysBefore(60) }),
        contact({ id: "cold", last_contact_date: daysBefore(120) }),
      ],
    })

    expect(moves.map((move) => move.contactId)).toEqual(["slipping", "fresh-meeting", "cold"])
    expect(moves[1].health?.level).toBe("green")
  })

  it("uses cadence-aware health for cold and cooling, with consistent thresholds", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      commitments: [],
      reviews: [],
      contacts: [
        // Weekly cadence, 20 days silent: well past 2x cadence, so cold well before 90 days.
        contact({ id: "weekly-cold", cadence_days: 7, last_contact_date: daysBefore(20) }),
        // Monthly cadence, 40 days: past cadence (yellow) so it is cooling even under 45 days.
        contact({ id: "monthly-cooling", cadence_days: 30, last_contact_date: daysBefore(40) }),
        // No cadence, 40 days: yellow but under the 45-day cooling floor.
        contact({ id: "default-40", last_contact_date: daysBefore(40) }),
        // No cadence, 60 days: cooling.
        contact({ id: "default-60", last_contact_date: daysBefore(60) }),
        // No cadence, 10 days: healthy, nothing to do.
        contact({ id: "healthy", last_contact_date: daysBefore(10) }),
      ],
    })

    expect(moves.map((move) => [move.contactId, move.signal])).toEqual([
      ["weekly-cold", "cold"],
      ["default-60", "cooling"],
      ["monthly-cooling", "cooling"],
    ])
  })

  it("always includes cooling contacts, no matter how long the list already is", () => {
    const cold = Array.from({ length: 8 }, (_, i) =>
      contact({ id: `cold-${i}`, last_contact_date: daysBefore(200 + i) }))
    const moves = buildNextMoves({
      nowMs: NOW,
      commitments: [],
      reviews: [],
      contacts: [...cold, contact({ id: "cooling", last_contact_date: daysBefore(60) })],
    })

    expect(moves).toHaveLength(9)
    expect(moves[moves.length - 1].contactId).toBe("cooling")
    // Oldest cold contact first.
    expect(moves[0].contactId).toBe("cold-7")
  })

  it("produces the same people, in the same order, for the dashboard and /reach-out", () => {
    const input = {
      nowMs: NOW,
      commitments: [commitment({ contact_id: "promised" })],
      reviews: [],
      contacts: [
        contact({ id: "promised", follow_up_needed: true }),
        contact({ id: "cold", last_contact_date: daysBefore(200) }),
        contact({ id: "flagged", follow_up_needed: true, last_contact_date: daysBefore(50) }),
        contact({ id: "scheduled", next_due_date: "2026-07-17" }),
      ],
    }
    const dashboard = buildNextMoves(input)
    const reachOut = relationshipMoves(buildNextMoves(input))

    expect(reachOut.map((move) => move.contactId)).toEqual(
      dashboard.filter((move) => move.kind === "follow_up").map((move) => move.contactId),
    )
    expect(reachOut.map((move) => move.contactId)).toEqual(["scheduled", "flagged", "cold"])
    // The contact with an open promise appears once, via the promise.
    expect(dashboard.filter((move) => move.contactId === "promised").map((move) => move.kind)).toEqual(["commitment"])
  })

  it("orders commitments overdue, due, unscheduled, then waiting-on-them, all ahead of cold contacts", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      reviews: [],
      contacts: [contact({ id: "cold", last_contact_date: daysBefore(200) })],
      commitments: [
        commitment({ id: "waiting", direction: "contact_owes", due_at: "2026-07-20T12:00:00.000Z" }),
        commitment({ id: "unscheduled", due_at: null }),
        commitment({ id: "due-later", due_at: "2026-07-25T12:00:00.000Z" }),
        commitment({ id: "very-overdue", due_at: "2026-07-01T12:00:00.000Z" }),
        commitment({ id: "overdue", due_at: "2026-07-15T12:00:00.000Z" }),
        commitment({ id: "done", status: "completed" }),
      ],
    })

    expect(moves.map((move) => move.id)).toEqual([
      "commitment:very-overdue",
      "commitment:overdue",
      "commitment:due-later",
      "commitment:unscheduled",
      "commitment:waiting",
      "follow-up:cold",
    ])
  })

  it("caps the dashboard at DASHBOARD_MOVE_LIMIT while /moves keeps the full ranked list", () => {
    const contacts = Array.from({ length: DASHBOARD_MOVE_LIMIT + 3 }, (_, i) =>
      contact({ id: `c-${i}`, follow_up_needed: true, last_contact_date: daysBefore(40 + i) }))
    const all = buildNextMoves({ nowMs: NOW, commitments: [], reviews: [], contacts })
    const dashboard = all.slice(0, DASHBOARD_MOVE_LIMIT)

    expect(all).toHaveLength(DASHBOARD_MOVE_LIMIT + 3)
    expect(dashboard).toEqual(all.slice(0, DASHBOARD_MOVE_LIMIT))
    expect(dashboard[0].contactId).toBe(`c-${DASHBOARD_MOVE_LIMIT + 2}`)
  })
})
