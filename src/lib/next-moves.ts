import { calculateHealthScore } from "@/lib/health"
import type { AfterCallReview, Commitment, HealthScore, IntroRequest } from "@/lib/types"

export type NextMoveKind = "commitment" | "review" | "follow_up" | "waiting" | "intro"

/**
 * Why a contact-level ("follow_up") move exists, strongest first:
 * scheduled (next_due_date reached) > flagged (follow_up_needed) >
 * cold (orange/red health) > cooling (yellow health, past cadence or 45+ days).
 */
export type RelationshipSignal = "scheduled" | "flagged" | "cold" | "cooling"

export interface NextMove {
  id: string
  kind: NextMoveKind
  /** Only set for contact-level moves (kind === "follow_up"). */
  signal: RelationshipSignal | null
  /** Health of the related contact, when we know it. */
  health: HealthScore | null
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
  cadence_days: number | null
  created_at: string
}

/** How many moves the dashboard shows before "View all" links to /moves. */
export const DASHBOARD_MOVE_LIMIT = 5

/** Yellow-health contacts without a cadence only surface once this stale. */
export const COOLING_MIN_DAYS = 45

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

function cadenceLabel(days: number): string {
  if (days === 7) return "Weekly"
  if (days === 14) return "Every 2 weeks"
  if (days === 30) return "Monthly"
  if (days === 90) return "Quarterly"
  return `Every ${days} days`
}

function formatDaysAgo(days: number): string {
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? "1 month ago" : `${months} months ago`
}

/** UTC calendar date (YYYY-MM-DD), matching how snoozed_until/next_due_date are stored. */
export function todayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

/** A contact is snoozed through the end of its snoozed_until date. */
export function isContactSnoozed(contact: Pick<MoveContact, "snoozed_until">, today: string): boolean {
  return !!contact.snoozed_until && contact.snoozed_until >= today
}

/**
 * The single strongest relationship reason for a contact, or null when the
 * contact needs nothing (snoozed, healthy and unflagged, or only mildly cooling).
 * Within a tier, the longest-neglected contact ranks first (fractional score).
 */
function relationshipMove(contact: MoveContact, today: string, nowMs: number): NextMove | null {
  if (isContactSnoozed(contact, today)) return null

  const health = calculateHealthScore(contact.last_contact_date, contact.created_at, contact.cadence_days, nowMs)
  const reference = contact.last_contact_date || contact.created_at
  const daysSince = Math.max(0, Math.floor((nowMs - new Date(reference).getTime()) / DAY_MS))
  const staleness = Math.min(daysSince, 999) / 1000
  const name = contact.name || "this contact"
  const base = {
    id: `follow-up:${contact.id}`,
    kind: "follow_up" as const,
    health,
    contactId: contact.id,
    contactName: contact.name,
    company: contact.company,
    href: `/contact/${contact.id}`,
  }

  if (contact.next_due_date && contact.next_due_date <= today) {
    const due = dueReason(contact.next_due_date, nowMs)
    return {
      ...base,
      signal: "scheduled",
      title: contact.next_steps || `Follow up with ${name}`,
      reason: contact.cadence_days
        ? `${cadenceLabel(contact.cadence_days)} check-in, ${due.toLowerCase()}`
        : `Scheduled follow-up, ${due.toLowerCase()}`,
      dueAt: contact.next_due_date,
      score: 400 + Math.max(-30, daysFromNow(contact.next_due_date, nowMs)),
    }
  }

  if (contact.follow_up_needed) {
    // A healthy (green) contact with a flag is usually a fresh meeting: still
    // worth doing, but it ranks below flags on relationships that are slipping.
    const healthy = health.level === "green"
    return {
      ...base,
      signal: "flagged",
      title: contact.next_steps || `Follow up with ${name}`,
      reason: `Follow-up needed, last contact ${formatDaysAgo(daysSince)}`,
      dueAt: null,
      score: (healthy ? 470 : 440) - staleness,
    }
  }

  if (health.level === "orange" || health.level === "red") {
    return {
      ...base,
      signal: "cold",
      title: `Reconnect with ${name}`,
      reason: `Last contact ${formatDaysAgo(daysSince)}`,
      dueAt: null,
      score: (health.level === "red" ? 600 : 610) - staleness,
    }
  }

  if (health.level === "yellow" && (contact.cadence_days || daysSince >= COOLING_MIN_DAYS)) {
    return {
      ...base,
      signal: "cooling",
      title: `Check in with ${name}`,
      reason: `Last contact ${formatDaysAgo(daysSince)}`,
      dueAt: null,
      score: 700 - staleness,
    }
  }

  return null
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
 * The one prioritized action list. Pure and explainable; the dashboard, /moves
 * and /reach-out all render (slices or filters of) this output.
 *
 * Lower score wins: overdue promises, pending reviews, due intro follow-ups,
 * due promises, unscheduled promises, scheduled contact check-ins, flagged
 * follow-ups, waiting-on-them, cold contacts, then cooling contacts.
 *
 * Each contact gets at most one relationship move (its strongest reason), and
 * none at all when a commitment, review, or intro already covers them.
 * Snoozed contacts (snoozed_until >= today) produce no relationship move;
 * commitments carry their own snooze.
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
  const today = todayKey(nowMs)
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
      signal: null,
      health: null,
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
      signal: null,
      health: null,
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
      signal: null,
      health: null,
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
    const move = relationshipMove(contact, today, nowMs)
    if (move) moves.push(move)
  }

  return moves.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
}

/** People-only view of the same list (what /reach-out renders). */
export function relationshipMoves(moves: NextMove[]): NextMove[] {
  return moves.filter((move) => move.kind === "follow_up")
}
