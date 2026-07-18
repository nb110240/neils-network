import type { AfterCallReview, Commitment, IntroRequest } from "@/lib/types"

export type NextMoveKind = "commitment" | "review" | "follow_up" | "waiting" | "intro"

export interface NextMove {
  id: string
  kind: NextMoveKind
  title: string
  reason: string
  contactId: string | null
  contactName: string | null
  company: string | null
  dueAt: string | null
  href: string
  score: number
}

export interface MoveContact {
  id: string
  name: string | null
  company: string | null
  next_steps: string | null
  follow_up_needed: boolean
  next_due_date: string | null
  snoozed_until: string | null
  last_contact_date: string | null
  created_at: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

function daysFromNow(value: string, nowMs: number): number {
  return Math.floor((new Date(value).getTime() - startOfDay(new Date(nowMs))) / DAY_MS)
}

function dueReason(dueAt: string | null, nowMs: number): string {
  if (!dueAt) return "No due date yet"
  const days = daysFromNow(dueAt, nowMs)
  if (days < -1) return `${Math.abs(days)} days overdue`
  if (days === -1) return "Overdue since yesterday"
  if (days === 0) return "Due today"
  if (days === 1) return "Due tomorrow"
  return `Due in ${days} days`
}

function commitmentScore(commitment: Commitment, nowMs: number): number {
  const dueDays = commitment.due_at ? daysFromNow(commitment.due_at, nowMs) : null
  if (commitment.direction === "user_owes" && dueDays !== null && dueDays < 0) {
    return Math.max(0, 50 + dueDays)
  }
  if (commitment.direction === "user_owes" && dueDays !== null) {
    return 200 + Math.min(dueDays, 60)
  }
  if (commitment.direction === "user_owes") {
    return 300 + (100 - commitment.priority)
  }
  return 500 + (dueDays === null ? 100 : Math.min(Math.max(dueDays, -30), 60))
}

/**
 * Pure, explainable ranking used by both the dashboard and Moves page.
 * Lower score wins: overdue promises, pending reviews, due promises,
 * unscheduled promises, due contact follow-ups, waiting-on-them, then health.
 */
export function buildNextMoves({
  commitments,
  reviews,
  contacts,
  introRequests = [],
  nowMs = Date.now(),
}: {
  commitments: Commitment[]
  reviews: AfterCallReview[]
  contacts: MoveContact[]
  introRequests?: IntroRequest[]
  nowMs?: number
}): NextMove[] {
  const contactMap = new Map(contacts.map((contact) => [contact.id, contact]))
  const today = new Date(nowMs).toISOString().slice(0, 10)
  const moves: NextMove[] = []
  const contactsWithPrimaryMoves = new Set<string>()

  for (const commitment of commitments) {
    if (!["open", "snoozed"].includes(commitment.status)) continue
    if (
      commitment.status === "snoozed" &&
      commitment.snoozed_until &&
      new Date(commitment.snoozed_until).getTime() > nowMs
    ) continue

    const contact = contactMap.get(commitment.contact_id)
    const waiting = commitment.direction === "contact_owes"
    moves.push({
      id: `commitment:${commitment.id}`,
      kind: waiting ? "waiting" : "commitment",
      title: commitment.title,
      reason: waiting
        ? `Waiting on ${contact?.name || "them"}${commitment.due_at ? `, ${dueReason(commitment.due_at, nowMs).toLowerCase()}` : ""}`
        : dueReason(commitment.due_at, nowMs),
      contactId: commitment.contact_id,
      contactName: contact?.name || null,
      company: contact?.company || null,
      dueAt: commitment.due_at,
      href: `/contact/${commitment.contact_id}`,
      score: commitmentScore(commitment, nowMs),
    })
    contactsWithPrimaryMoves.add(commitment.contact_id)
  }

  for (const review of reviews) {
    if (review.status !== "pending") continue
    const contact = review.contact_id ? contactMap.get(review.contact_id) : null
    moves.push({
      id: `review:${review.id}`,
      kind: "review",
      title: `Review ${review.title}`,
      reason: `${review.proposed_commitments.length} proposed action${review.proposed_commitments.length === 1 ? "" : "s"} waiting for approval`,
      contactId: review.contact_id,
      contactName: contact?.name || review.proposed_contact_patch.name || null,
      company: contact?.company || review.proposed_contact_patch.company || null,
      dueAt: review.occurred_at,
      href: `/inbox?review=${review.id}`,
      score: 100 + Math.max(0, daysFromNow(review.occurred_at, nowMs)),
    })
    if (review.contact_id) contactsWithPrimaryMoves.add(review.contact_id)
  }

  for (const intro of introRequests) {
    if (["meeting_booked", "closed", "declined"].includes(intro.status)) continue
    const target = contactMap.get(intro.target_contact_id)
    const followUpDays = intro.next_follow_up_at ? daysFromNow(intro.next_follow_up_at, nowMs) : null
    const statusReason = intro.status === "draft"
      ? "Warm path is ready for your approval"
      : intro.status === "requested"
        ? "Waiting for the connector to respond"
        : intro.status === "accepted"
          ? "Connector agreed; help them make the introduction"
          : "Introduction made; move toward a meeting"
    moves.push({
      id: `intro:${intro.id}`,
      kind: "intro",
      title: intro.status === "draft"
        ? `Review warm intro ask for ${target?.name || "your target"}`
        : `Advance introduction to ${target?.name || "your target"}`,
      reason: followUpDays !== null ? `${statusReason}. ${dueReason(intro.next_follow_up_at, nowMs)}` : statusReason,
      contactId: intro.target_contact_id,
      contactName: target?.name || null,
      company: target?.company || null,
      dueAt: intro.next_follow_up_at,
      href: `/intros#intro-${intro.id}`,
      score: intro.status === "draft"
        ? 250
        : followUpDays !== null && followUpDays <= 0
          ? 150 + Math.max(-30, followUpDays)
          : 550 + (followUpDays ?? 30),
    })
    contactsWithPrimaryMoves.add(intro.target_contact_id)
  }

  for (const contact of contacts) {
    if (contactsWithPrimaryMoves.has(contact.id)) continue
    if (contact.snoozed_until && contact.snoozed_until >= today) continue

    if (contact.next_due_date && contact.next_due_date <= today) {
      moves.push({
        id: `follow-up:${contact.id}`,
        kind: "follow_up",
        title: contact.next_steps || `Follow up with ${contact.name || "this contact"}`,
        reason: dueReason(contact.next_due_date, nowMs),
        contactId: contact.id,
        contactName: contact.name,
        company: contact.company,
        dueAt: contact.next_due_date,
        href: `/contact/${contact.id}`,
        score: 400 + Math.max(-30, daysFromNow(contact.next_due_date, nowMs)),
      })
      continue
    }

    if (contact.follow_up_needed) {
      moves.push({
        id: `follow-up:${contact.id}`,
        kind: "follow_up",
        title: contact.next_steps || `Follow up with ${contact.name || "this contact"}`,
        reason: "Follow-up marked as needed",
        contactId: contact.id,
        contactName: contact.name,
        company: contact.company,
        dueAt: null,
        href: `/contact/${contact.id}`,
        score: 450,
      })
      continue
    }

    const reference = contact.last_contact_date || contact.created_at
    const daysSince = Math.floor((nowMs - new Date(reference).getTime()) / DAY_MS)
    if (daysSince >= 90) {
      moves.push({
        id: `follow-up:${contact.id}`,
        kind: "follow_up",
        title: `Reconnect with ${contact.name || "this contact"}`,
        reason: `${daysSince} days since your last interaction`,
        contactId: contact.id,
        contactName: contact.name,
        company: contact.company,
        dueAt: null,
        href: `/contact/${contact.id}`,
        score: 700 - Math.min(Math.max(daysSince - 90, 0), 99),
      })
    }
  }

  return moves.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
}
