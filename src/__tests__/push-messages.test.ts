import { describe, expect, it } from "vitest"
import { calendarReviewsMessage, dailyMovesMessage, forwardedNotesMessage } from "@/lib/push/messages"

const promise = (title: string, contactName: string, contactId = "c1") => ({ title, contactName, contactId, dueAt: "2026-10-02T17:00:00Z" })

describe("dailyMovesMessage", () => {
  it("leads with the promise and counts everything else", () => {
    expect(dailyMovesMessage({
      promises: [promise("Send the deck", "Maya Chen"), promise("Intro to Sam", "Leo Park", "c2")],
      pendingReviews: 2,
      introFollowUps: [{ targetName: "Ana" }],
    })).toEqual({
      title: "You promised Maya Chen",
      body: "Send the deck · 4 more moves today",
      url: "/contact/c1",
      threadId: "daily-moves",
    })
  })

  it("says just the promise when it is the only thing", () => {
    expect(dailyMovesMessage({ promises: [promise("Send the deck", "Maya")], pendingReviews: 0, introFollowUps: [] })?.body).toBe("Send the deck")
  })

  it("falls back to reviews, then intro follow-ups, then nothing", () => {
    expect(dailyMovesMessage({ promises: [], pendingReviews: 1, introFollowUps: [] })).toMatchObject({ body: "1 meeting ready for your approval", url: "/inbox" })
    expect(dailyMovesMessage({ promises: [], pendingReviews: 0, introFollowUps: [{ targetName: "Ana" }, { targetName: "Bo" }] }))
      .toMatchObject({ body: "Check in on your intro to Ana and 1 other", url: "/intros" })
    expect(dailyMovesMessage({ promises: [], pendingReviews: 0, introFollowUps: [] })).toBeNull()
  })

  it("keeps lock-screen text short and on one line", () => {
    const long = "Send the updated deck with the new retention cohort charts and the revised hiring plan\nplus the data room link"
    const msg = dailyMovesMessage({ promises: [promise(long, "A very long contact name that keeps going and going")], pendingReviews: 0, introFollowUps: [] })!
    expect(msg.title.length).toBeLessThanOrEqual(60)
    expect(msg.body).not.toContain("\n")
    expect(msg.title.endsWith("…")).toBe(true)
  })
})

describe("review messages", () => {
  it("nudges after calendar meetings, and only when there are some", () => {
    expect(calendarReviewsMessage(0)).toBeNull()
    expect(calendarReviewsMessage(1)?.body).toBe("Notes from a recent meeting are ready to review")
    expect(calendarReviewsMessage(3)).toMatchObject({ title: "How did your meetings go?", body: "Notes from 3 recent meetings are ready to review", url: "/inbox" })
  })

  it("deep-links forwarded notes to their review", () => {
    expect(forwardedNotesMessage("Fwd: Seed call", "rev 1")).toMatchObject({ body: '"Fwd: Seed call" is ready to review', url: "/inbox?review=rev%201" })
  })

  it("never uses em dashes in notification copy", () => {
    const all = [
      dailyMovesMessage({ promises: [promise("x", "y")], pendingReviews: 1, introFollowUps: [] }),
      dailyMovesMessage({ promises: [], pendingReviews: 2, introFollowUps: [] }),
      dailyMovesMessage({ promises: [], pendingReviews: 0, introFollowUps: [{ targetName: "a" }] }),
      calendarReviewsMessage(2),
      forwardedNotesMessage("s", "r"),
    ]
    for (const m of all) expect(`${m?.title} ${m?.body}`).not.toContain("—")
  })
})
