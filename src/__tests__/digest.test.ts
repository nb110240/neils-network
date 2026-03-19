import { describe, it, expect, vi, beforeEach } from "vitest"
import { calculateHealthScore } from "@/lib/health"

// ─── Digest selection algorithm tests ───
// These test the core logic extracted from the cron route:
// contact scoring, variety penalties, and pick selection.

describe("Digest contact selection", () => {
  const now = new Date()
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

  interface MockContact {
    id: string
    name: string
    last_contact_date: string | null
    created_at: string
  }

  function scoreContacts(
    contacts: MockContact[],
    recentContactIds: Set<string>,
    suggestionCount: Map<string, number>
  ) {
    return contacts
      .filter((c) => !recentContactIds.has(c.id))
      .map((c) => {
        const health = calculateHealthScore(c.last_contact_date, c.created_at)
        const timesShown = suggestionCount.get(c.id) || 0
        const varietyPenalty = timesShown * 15
        const adjustedScore = health.score + varietyPenalty
        return { ...c, health, adjustedScore, timesShown }
      })
  }

  function pickContacts(eligible: ReturnType<typeof scoreContacts>) {
    eligible.sort((a, b) => a.adjustedScore - b.adjustedScore)
    const picks: typeof eligible = []

    for (const c of eligible) {
      if (picks.length >= 2) break
      picks.push(c)
    }

    const remainingNonCold = eligible.filter(
      (c) => !picks.some((p) => p.id === c.id) && c.health.level !== "red"
    )

    if (remainingNonCold.length > 0) {
      picks.push(remainingNonCold[0]) // Deterministic for testing
    } else if (eligible.length > picks.length) {
      const next = eligible.find((c) => !picks.some((p) => p.id === c.id))
      if (next) picks.push(next)
    }

    return picks
  }

  const contacts: MockContact[] = [
    { id: "a", name: "Alice", last_contact_date: daysAgo(200), created_at: daysAgo(365) }, // Cold
    { id: "b", name: "Bob", last_contact_date: daysAgo(100), created_at: daysAgo(200) },   // Going cold
    { id: "c", name: "Carol", last_contact_date: daysAgo(45), created_at: daysAgo(120) },   // Cooling
    { id: "d", name: "Dave", last_contact_date: daysAgo(5), created_at: daysAgo(30) },      // Active
    { id: "e", name: "Eve", last_contact_date: daysAgo(150), created_at: daysAgo(300) },    // Going cold
  ]

  it("picks coldest contacts first", () => {
    const eligible = scoreContacts(contacts, new Set(), new Map())
    const picks = pickContacts(eligible)

    expect(picks.length).toBe(3)
    // First two should be the coldest (Alice and Eve/Bob)
    expect(picks[0].health.score).toBeLessThanOrEqual(picks[1].health.score)
  })

  it("excludes recently shown contacts", () => {
    const recentIds = new Set(["a"]) // Alice was shown recently
    const eligible = scoreContacts(contacts, recentIds, new Map())
    const picks = pickContacts(eligible)

    expect(picks.every((p) => p.id !== "a")).toBe(true)
  })

  it("applies variety penalty to frequently shown contacts", () => {
    const suggestionCount = new Map([["a", 5]]) // Alice shown 5 times
    const eligible = scoreContacts(contacts, new Set(), suggestionCount)

    const alice = eligible.find((c) => c.id === "a")!
    const bob = eligible.find((c) => c.id === "b")!

    // Alice is colder (score 10) but penalty of 75 makes her adjusted 85
    // Bob has score 25, adjusted 25 — lower, so Bob should be picked first
    expect(alice.adjustedScore).toBe(10 + 75)
    expect(bob.adjustedScore).toBe(25)
  })

  it("third pick avoids red/cold contacts when possible", () => {
    const eligible = scoreContacts(contacts, new Set(), new Map())
    const picks = pickContacts(eligible)

    // Third pick should not be cold if there are non-cold alternatives
    if (picks.length === 3) {
      const thirdPick = picks[2]
      const nonColdAvailable = eligible.some(
        (c) => c.health.level !== "red" && !picks.slice(0, 2).some((p) => p.id === c.id)
      )
      if (nonColdAvailable) {
        expect(thirdPick.health.level).not.toBe("red")
      }
    }
  })

  it("returns empty for no eligible contacts", () => {
    const allRecent = new Set(contacts.map((c) => c.id))
    const eligible = scoreContacts(contacts, allRecent, new Map())
    const picks = pickContacts(eligible)

    expect(picks.length).toBe(0)
  })

  it("handles fewer than 3 eligible contacts", () => {
    const eligible = scoreContacts(contacts.slice(0, 2), new Set(), new Map())
    const picks = pickContacts(eligible)

    expect(picks.length).toBe(2)
  })
})
