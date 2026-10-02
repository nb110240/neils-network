import type { PushMessage } from "./types"

// Notification copy. Kept short: iOS shows about 110 characters of body on
// the lock screen and truncates titles around 40.

const TITLE_MAX = 60
const BODY_MAX = 160

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

export interface DuePromise {
  title: string
  contactId: string
  contactName: string
  dueAt: string
}

/**
 * The daily nudge: the most urgent promise first, then notes waiting for
 * review, then intro follow-ups. Null when there is nothing worth a buzz.
 */
export function dailyMovesMessage(input: {
  promises: DuePromise[]
  pendingReviews: number
  introFollowUps: Array<{ targetName: string }>
}): PushMessage | null {
  const extras = input.promises.length - 1 + input.pendingReviews + input.introFollowUps.length
  if (input.promises.length > 0) {
    const first = input.promises[0]
    return {
      title: clip(`You promised ${first.contactName}`, TITLE_MAX),
      body: clip(extras > 0 ? `${first.title} · ${plural(extras, "more move")} today` : first.title, BODY_MAX),
      url: `/contact/${first.contactId}`,
      threadId: "daily-moves",
    }
  }
  if (input.pendingReviews > 0) {
    return {
      title: "Meeting notes to review",
      body: `${plural(input.pendingReviews, "meeting")} ready for your approval`,
      url: "/inbox",
      threadId: "daily-moves",
    }
  }
  if (input.introFollowUps.length > 0) {
    const others = input.introFollowUps.length - 1
    return {
      title: "Intro follow-up due",
      body: clip(
        `Check in on your intro to ${input.introFollowUps[0].targetName}${others > 0 ? ` and ${plural(others, "other")}` : ""}`,
        BODY_MAX
      ),
      url: "/intros",
      threadId: "daily-moves",
    }
  }
  return null
}

/** Meetings synced from the calendar that now have a review waiting. */
export function calendarReviewsMessage(count: number): PushMessage | null {
  if (count <= 0) return null
  return {
    title: "How did your meetings go?",
    body: count === 1 ? "Notes from a recent meeting are ready to review" : `Notes from ${count} recent meetings are ready to review`,
    url: "/inbox",
    threadId: "reviews",
  }
}

/** A forwarded email turned into a review. */
export function forwardedNotesMessage(subject: string, reviewId: string): PushMessage {
  return {
    title: "Forwarded notes ready",
    body: clip(`"${subject}" is ready to review`, BODY_MAX),
    url: `/inbox?review=${encodeURIComponent(reviewId)}`,
    threadId: "reviews",
  }
}
