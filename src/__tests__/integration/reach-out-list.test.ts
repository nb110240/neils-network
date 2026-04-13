import { describe, it, expect } from "vitest"
import { calculateHealthScore } from "@/lib/health"

describe("Reach Out Today prioritization", () => {
  const now = Date.now()
  const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString()

  function makeContact(overrides: Record<string, unknown>) {
    return {
      id: Math.random().toString(),
      name: "Test",
      email: null,
      phone: null,
      company: null,
      job_title: null,
      website: null,
      how_we_met: null,
      next_steps: null,
      follow_up_needed: false,
      last_contact_date: null,
      raw_note: "",
      embedding_status: "complete" as const,
      source: "web",
      created_by: "user1",
      created_at: daysAgo(30),
      updated_at: daysAgo(30),
      cadence_days: null,
      scheduled_follow_up: null,
      snoozed_until: null,
      next_due_date: null,
      archived_at: null,
      ...overrides,
    }
  }

  it("follow_up_needed contacts come first", () => {
    const contacts = [
      makeContact({ name: "Cold", last_contact_date: daysAgo(200) }),
      makeContact({ name: "Follow Up", follow_up_needed: true, last_contact_date: daysAgo(5) }),
    ].map((c) => ({
      ...c,
      health: calculateHealthScore(c.last_contact_date, c.created_at),
    }))

    const followUps = contacts.filter((c) => c.follow_up_needed)
    const cold = contacts.filter((c) => !c.follow_up_needed && (c.health.level === "orange" || c.health.level === "red"))

    const reachOut = [...followUps, ...cold]
    expect(reachOut[0].name).toBe("Follow Up")
    expect(reachOut[1].name).toBe("Cold")
  })

  it("cold contacts sorted by oldest first", () => {
    const contacts = [
      makeContact({ name: "Recently Cold", last_contact_date: daysAgo(100) }),
      makeContact({ name: "Very Cold", last_contact_date: daysAgo(200) }),
    ].map((c) => ({
      ...c,
      health: calculateHealthScore(c.last_contact_date, c.created_at),
    }))

    const sorted = contacts
      .filter((c) => c.health.level === "orange" || c.health.level === "red")
      .sort((a, b) => new Date(a.last_contact_date!).getTime() - new Date(b.last_contact_date!).getTime())

    expect(sorted[0].name).toBe("Very Cold")
  })

  it("new contacts detected correctly (added in last 7 days, not followed up)", () => {
    const contacts = [
      makeContact({ name: "New", created_at: daysAgo(2), last_contact_date: null }),
      makeContact({ name: "New But Contacted", created_at: daysAgo(2), last_contact_date: daysAgo(1) }),
      makeContact({ name: "Old", created_at: daysAgo(14), last_contact_date: null }),
    ]

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const newContacts = contacts.filter((c) => {
      const createdAt = new Date(c.created_at).getTime()
      if (createdAt < sevenDaysAgo) return false
      if (!c.last_contact_date) return true
      const lastContact = new Date(c.last_contact_date).getTime()
      const created = new Date(c.created_at).getTime()
      return Math.abs(lastContact - created) < 60_000
    })

    expect(newContacts).toHaveLength(1)
    expect(newContacts[0].name).toBe("New")
  })
})
