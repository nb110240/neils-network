import { describe, expect, it } from "vitest"
import { rankIntroPaths, type IntroPathContact } from "@/lib/intro-paths"

const NOW = new Date("2026-07-17T12:00:00.000Z").getTime()

function person(overrides: Partial<IntroPathContact> = {}): IntroPathContact {
  return {
    id: "person-1",
    name: "Alex Investor",
    company: "Northstar Ventures",
    job_title: "Partner",
    how_we_met: null,
    next_steps: null,
    raw_note: null,
    last_contact_date: "2026-07-01",
    created_at: "2026-01-01T00:00:00.000Z",
    tags: ["fintech"],
    ...overrides,
  }
}

describe("rankIntroPaths", () => {
  it("ranks explicit relationship evidence above company and tag context", () => {
    const target = person()
    const paths = rankIntroPaths(target, [
      target,
      person({ id: "verified", name: "Vera", company: "Other", raw_note: "Worked with Alex Investor on the Acme board." }),
      person({ id: "firm", name: "Finn", company: "Northstar Ventures", tags: [] }),
      person({ id: "tag", name: "Taylor", company: "Unrelated", tags: ["fintech"] }),
    ], NOW)

    expect(paths.map((path) => path.connector.id)).toEqual(["verified", "firm", "tag"])
    expect(paths[0].confidence).toBe("verified")
    expect(paths[1].confidence).toBe("possible")
    expect(paths[2].confidence).toBe("context_only")
  })

  it("omits contacts with no relationship or contextual evidence", () => {
    const paths = rankIntroPaths(person(), [person({ id: "stranger", company: "Elsewhere", tags: [] })], NOW)
    expect(paths).toEqual([])
  })

  it("labels a bare name mention as possible rather than verified", () => {
    const paths = rankIntroPaths(person(), [person({ id: "mention", raw_note: "Alex Investor attended the demo day." })], NOW)
    expect(paths[0].confidence).toBe("possible")
    expect(paths[0].evidence).toContain("Confirm they know each other")
  })
})
