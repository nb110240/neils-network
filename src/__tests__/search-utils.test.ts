import { describe, it, expect } from "vitest"
import {
  reciprocalRankFusion,
  recencyBoost,
  exactMatchBoost,
  healthBoost,
  type ScoredContact,
} from "@/lib/search-utils"

// ─── reciprocalRankFusion ───

describe("reciprocalRankFusion", () => {
  it("scores a single list correctly", () => {
    const list: ScoredContact[] = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]
    const scores = reciprocalRankFusion(list)

    // rank 0 -> 1/(60+0+1) = 1/61
    expect(scores.get("a")).toBeCloseTo(1 / 61, 6)
    // rank 1 -> 1/(60+1+1) = 1/62
    expect(scores.get("b")).toBeCloseTo(1 / 62, 6)
    // rank 2 -> 1/(60+2+1) = 1/63
    expect(scores.get("c")).toBeCloseTo(1 / 63, 6)
  })

  it("merges overlapping results from multiple lists", () => {
    const list1: ScoredContact[] = [{ id: "a" }, { id: "b" }]
    const list2: ScoredContact[] = [{ id: "b" }, { id: "c" }]
    const scores = reciprocalRankFusion(list1, list2)

    // "b" appears in both lists: rank 1 in list1 + rank 0 in list2
    expect(scores.get("b")).toBeCloseTo(1 / 62 + 1 / 61, 6)
    // "a" only in list1 at rank 0
    expect(scores.get("a")).toBeCloseTo(1 / 61, 6)
    // "c" only in list2 at rank 1
    expect(scores.get("c")).toBeCloseTo(1 / 62, 6)
  })

  it("handles empty lists gracefully", () => {
    const scores = reciprocalRankFusion([], [])
    expect(scores.size).toBe(0)
  })

  it("handles one empty and one populated list", () => {
    const list: ScoredContact[] = [{ id: "x" }]
    const scores = reciprocalRankFusion(list, [])
    expect(scores.size).toBe(1)
    expect(scores.get("x")).toBeCloseTo(1 / 61, 6)
  })

  it("items appearing in more lists get higher scores", () => {
    const list1: ScoredContact[] = [{ id: "a" }, { id: "b" }]
    const list2: ScoredContact[] = [{ id: "a" }, { id: "c" }]
    const list3: ScoredContact[] = [{ id: "a" }, { id: "d" }]
    const scores = reciprocalRankFusion(list1, list2, list3)

    // "a" appears at rank 0 in all 3 lists
    expect(scores.get("a")).toBeCloseTo(3 / 61, 6)
    // "b" appears once
    expect(scores.get("b")!).toBeLessThan(scores.get("a")!)
  })
})

// ─── recencyBoost ───

describe("recencyBoost", () => {
  const now = new Date()
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

  it("returns 0.15 for contact within 7 days", () => {
    expect(recencyBoost(daysAgo(3), daysAgo(30))).toBe(0.15)
  })

  it("returns 0.10 for contact within 8-30 days", () => {
    expect(recencyBoost(daysAgo(15), daysAgo(60))).toBe(0.10)
  })

  it("returns 0.05 for contact within 31-90 days", () => {
    expect(recencyBoost(daysAgo(60), daysAgo(120))).toBe(0.05)
  })

  it("returns 0 for contact over 90 days", () => {
    expect(recencyBoost(daysAgo(180), daysAgo(365))).toBe(0)
  })

  it("uses createdAt when lastContactDate is null", () => {
    expect(recencyBoost(null, daysAgo(5))).toBe(0.15)
  })
})

// ─── exactMatchBoost ───

describe("exactMatchBoost", () => {
  it("returns 0.3 for exact name match", () => {
    const contact: ScoredContact = { id: "1", name: "Alice Smith", company: "Acme" }
    expect(exactMatchBoost(contact, "alice smith")).toBe(0.3)
  })

  it("returns 0.15 for partial name match", () => {
    const contact: ScoredContact = { id: "1", name: "Alice Smith", company: "Acme" }
    expect(exactMatchBoost(contact, "alice")).toBe(0.15)
  })

  it("returns 0.2 for exact company match", () => {
    const contact: ScoredContact = { id: "1", name: "Bob", company: "Acme" }
    expect(exactMatchBoost(contact, "acme")).toBe(0.2)
  })

  it("returns 0.1 for partial company match", () => {
    const contact: ScoredContact = { id: "1", name: "Bob", company: "Acme Corp" }
    expect(exactMatchBoost(contact, "acme")).toBe(0.1)
  })

  it("returns combined boost for name and company match", () => {
    // exact name (0.3) + partial company (0.1) since query "alice" is contained in company "alice inc"
    const contact: ScoredContact = { id: "1", name: "alice", company: "alice inc" }
    expect(exactMatchBoost(contact, "alice")).toBe(0.3 + 0.1)
  })

  it("returns 0 when no match", () => {
    const contact: ScoredContact = { id: "1", name: "Alice Smith", company: "Acme" }
    expect(exactMatchBoost(contact, "completely different")).toBe(0)
  })

  it("handles null name and company gracefully", () => {
    const contact: ScoredContact = { id: "1", name: null, company: null }
    expect(exactMatchBoost(contact, "test")).toBe(0)
  })
})

// ─── healthBoost ───

describe("healthBoost", () => {
  it("returns 0.05 for green health", () => {
    expect(healthBoost({ score: 100, level: "green", label: "Active" })).toBe(0.05)
  })

  it("returns 0 for yellow health", () => {
    expect(healthBoost({ score: 50, level: "yellow", label: "Cooling" })).toBe(0)
  })

  it("returns 0 for orange health", () => {
    expect(healthBoost({ score: 25, level: "orange", label: "Going cold" })).toBe(0)
  })

  it("returns 0 for red health", () => {
    expect(healthBoost({ score: 10, level: "red", label: "Cold" })).toBe(0)
  })
})
