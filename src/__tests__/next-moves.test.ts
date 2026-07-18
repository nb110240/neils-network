import { describe, expect, it } from "vitest"
import { buildNextMoves, type MoveContact } from "@/lib/next-moves"
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
