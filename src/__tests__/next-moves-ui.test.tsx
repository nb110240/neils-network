import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/components/posthog-provider", () => ({ captureEvent: vi.fn() }))

import { NextMoves } from "@/components/next-moves"
import { buildNextMoves, DASHBOARD_MOVE_LIMIT } from "@/lib/next-moves"

const NOW = new Date("2026-07-17T12:00:00.000Z").getTime()

function flagged(i: number) {
  return {
    id: `c-${i}`,
    name: `Person ${i}`,
    company: null,
    next_steps: null,
    follow_up_needed: true,
    next_due_date: null,
    snoozed_until: null,
    last_contact_date: "2026-05-01",
    cadence_days: null,
    created_at: "2026-01-01T00:00:00.000Z",
  }
}

describe("NextMoves list", () => {
  it("always renders the tour target, even when empty", () => {
    const html = renderToStaticMarkup(<NextMoves moves={[]} />)
    expect(html).toContain('data-tour="next-moves"')
    expect(html).toContain("Nothing needs you right now")
  })

  it("shows the top moves with a View all link to /moves when there are more", () => {
    const moves = buildNextMoves({
      nowMs: NOW,
      commitments: [],
      reviews: [],
      contacts: Array.from({ length: DASHBOARD_MOVE_LIMIT + 2 }, (_, i) => flagged(i)),
    })
    const html = renderToStaticMarkup(<NextMoves moves={moves} />)
    expect(html.match(/<li/g)).toHaveLength(DASHBOARD_MOVE_LIMIT)
    expect(html).toContain('href="/moves"')
    expect(html).toContain(`>${DASHBOARD_MOVE_LIMIT + 2}<`)
  })

  it("dashboard walkthrough only targets elements the dashboard always renders", () => {
    const tour = readFileSync(join(process.cwd(), "src/components/dashboard-walkthrough.tsx"), "utf8")
    const dashboard = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"), "utf8")
    const nextMoves = readFileSync(join(process.cwd(), "src/components/next-moves.tsx"), "utf8")
    const targets = [...tour.matchAll(/data-tour='([^']+)'/g)].map((m) => m[1])
    expect(targets).toContain("next-moves")
    for (const target of targets) {
      expect(dashboard.includes(`data-tour="${target}"`) || nextMoves.includes(`data-tour="${target}"`)).toBe(true)
    }
  })
})
