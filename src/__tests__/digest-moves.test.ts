import { describe, expect, it } from "vitest"
import { buildDigestMoves, hasDigestMoves } from "@/lib/digest-moves"
import { digestSubject, renderDigestMoves } from "@/lib/email"

const NOW = new Date("2026-10-05T14:00:00Z")
const names = new Map<string, string | null>([["c1", "Sarah Lee"], ["c2", "Omar"], ["t1", "Jane VC"], ["k1", "Priya"]])

describe("buildDigestMoves", () => {
  it("surfaces promises due within 3 days or overdue, soonest first", () => {
    const moves = buildDigestMoves({
      now: NOW,
      pendingReviews: 0,
      intros: [],
      contactNames: names,
      commitments: [
        { id: "a", contact_id: "c1", direction: "user_owes", title: "Send the deck", due_at: "2026-10-07T17:00:00Z" },
        { id: "b", contact_id: "c2", direction: "user_owes", title: "Intro to CTO", due_at: "2026-10-03T17:00:00Z" },
        { id: "c", contact_id: "c1", direction: "user_owes", title: "Far away", due_at: "2026-10-20T17:00:00Z" },
        { id: "d", contact_id: "c1", direction: "user_owes", title: "No date", due_at: null },
      ],
    })
    expect(moves.promises.map((p) => [p.title, p.overdue])).toEqual([["Intro to CTO", true], ["Send the deck", false]])
  })

  it("only lists what others owe once it is late, and skips archived contacts", () => {
    const moves = buildDigestMoves({
      now: NOW,
      pendingReviews: 2,
      intros: [],
      contactNames: names,
      commitments: [
        { id: "a", contact_id: "c1", direction: "contact_owes", title: "Term sheet draft", due_at: "2026-10-01T00:00:00Z" },
        { id: "b", contact_id: "c2", direction: "contact_owes", title: "Not late yet", due_at: "2026-10-06T00:00:00Z" },
        { id: "c", contact_id: "gone", direction: "user_owes", title: "Archived", due_at: "2026-10-04T00:00:00Z" },
      ],
    })
    expect(moves.waitingOn.map((w) => w.title)).toEqual(["Term sheet draft"])
    expect(moves.promises).toEqual([])
    expect(moves.pendingReviews).toBe(2)
    expect(hasDigestMoves(moves)).toBe(true)
  })

  it("includes intro follow-ups that are due", () => {
    const moves = buildDigestMoves({
      now: NOW,
      pendingReviews: 0,
      commitments: [],
      contactNames: names,
      intros: [
        { id: "i1", target_contact_id: "t1", connector_contact_id: "k1", status: "requested", next_follow_up_at: "2026-10-04T00:00:00Z" },
        { id: "i2", target_contact_id: "t1", connector_contact_id: "k1", status: "requested", next_follow_up_at: "2026-10-09T00:00:00Z" },
      ],
    })
    expect(moves.introFollowUps).toEqual([{ targetName: "Jane VC", connectorName: "Priya", status: "requested" }])
  })

  it("reports nothing to do when everything is empty", () => {
    expect(hasDigestMoves(buildDigestMoves({ now: NOW, pendingReviews: 0, commitments: [], intros: [], contactNames: names }))).toBe(false)
  })
})

describe("digest moves rendering", () => {
  const moves = buildDigestMoves({
    now: NOW,
    pendingReviews: 1,
    intros: [],
    contactNames: new Map([["c1", "<b>Sarah</b>"]]),
    commitments: [{ id: "a", contact_id: "c1", direction: "user_owes", title: "Send <script>deck</script>", due_at: "2026-10-06T17:00:00Z" }],
  })

  it("escapes names and titles and links to the contact and inbox", () => {
    const html = renderDigestMoves(moves, "https://savvo.app")
    expect(html).toContain("&lt;b&gt;Sarah&lt;/b&gt;")
    expect(html).toContain("Send &lt;script&gt;deck&lt;/script&gt;")
    expect(html).not.toContain("<script>")
    expect(html).toContain("https://savvo.app/contact/c1")
    expect(html).toContain("https://savvo.app/inbox")
    expect(html).toContain("1 meeting note is waiting")
  })

  it("leads the subject with the first promise", () => {
    expect(digestSubject(3, moves, false)).toMatch(/^You promised <b>Sarah<\/b>: Send <script>deck<\/script>, due /)
    expect(digestSubject(3, undefined, true)).toBe("Your weekly network check-in: 3 relationships need attention")
  })
})
