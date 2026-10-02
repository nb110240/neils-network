// ─── Raise Autopilot items for the digest email ───
// Promises the user made, things others owe them, meeting notes waiting for
// review, and intro follow-ups that are due. These are the most valuable
// lines the digest can carry ("You promised Sarah the deck by Friday").

export interface DigestCommitmentRow {
  id: string
  contact_id: string
  direction: "user_owes" | "contact_owes"
  title: string
  due_at: string | null
}

export interface DigestIntroRow {
  id: string
  target_contact_id: string
  connector_contact_id: string | null
  status: string
  next_follow_up_at: string | null
}

export interface DigestMoveItem {
  title: string
  contactId: string
  contactName: string
  dueAt: string | null
  overdue: boolean
}

export interface DigestMoves {
  promises: DigestMoveItem[]
  waitingOn: DigestMoveItem[]
  pendingReviews: number
  introFollowUps: Array<{ targetName: string; connectorName: string | null; status: string }>
}

const MAX_ITEMS = 5
const DAY_MS = 24 * 60 * 60 * 1000
/** Promises are surfaced when due within this window, or already overdue. */
export const PROMISE_WINDOW_DAYS = 3

export function buildDigestMoves(input: {
  commitments: DigestCommitmentRow[]
  pendingReviews: number
  intros: DigestIntroRow[]
  contactNames: Map<string, string | null>
  now?: Date
}): DigestMoves {
  const now = input.now ?? new Date()
  const horizon = now.getTime() + PROMISE_WINDOW_DAYS * DAY_MS
  const name = (id: string | null) => (id ? input.contactNames.get(id) : null) || null

  const toItem = (c: DigestCommitmentRow): DigestMoveItem | null => {
    const contactName = name(c.contact_id)
    // Contacts not in the active list (archived) are skipped.
    if (!contactName) return null
    return {
      title: c.title,
      contactId: c.contact_id,
      contactName,
      dueAt: c.due_at,
      overdue: c.due_at !== null && new Date(c.due_at).getTime() < now.getTime(),
    }
  }
  const byDue = (a: DigestMoveItem, b: DigestMoveItem) =>
    new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime()

  const promises = input.commitments
    .filter((c) => c.direction === "user_owes" && c.due_at && new Date(c.due_at).getTime() <= horizon)
    .map(toItem)
    .filter((c): c is DigestMoveItem => c !== null)
    .sort(byDue)
    .slice(0, MAX_ITEMS)

  // Others' promises only matter once they're late: that's when to nudge.
  const waitingOn = input.commitments
    .filter((c) => c.direction === "contact_owes" && c.due_at && new Date(c.due_at).getTime() < now.getTime())
    .map(toItem)
    .filter((c): c is DigestMoveItem => c !== null)
    .sort(byDue)
    .slice(0, MAX_ITEMS)

  const introFollowUps = input.intros
    .filter((i) => i.next_follow_up_at && new Date(i.next_follow_up_at).getTime() <= now.getTime())
    .map((i) => ({ targetName: name(i.target_contact_id), connectorName: name(i.connector_contact_id), status: i.status }))
    .filter((i): i is { targetName: string; connectorName: string | null; status: string } => i.targetName !== null)
    .slice(0, MAX_ITEMS)

  return { promises, waitingOn, pendingReviews: Math.max(0, input.pendingReviews), introFollowUps }
}

export function hasDigestMoves(moves: DigestMoves | null | undefined): moves is DigestMoves {
  return !!moves && (moves.promises.length + moves.waitingOn.length + moves.introFollowUps.length > 0 || moves.pendingReviews > 0)
}
