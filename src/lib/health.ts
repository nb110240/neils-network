import { type HealthScore, type HealthLevel } from "@/lib/types"

export function calculateHealthScore(
  lastContactDate: string | null,
  createdAt: string,
  cadenceDays?: number | null
): HealthScore {
  const referenceDate = lastContactDate || createdAt
  const daysSince = Math.floor(
    (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  let score: number
  let level: HealthLevel
  let label: string

  if (cadenceDays && cadenceDays >= 1) {
    // User-set cadence: thresholds relative to their chosen interval
    if (daysSince <= cadenceDays) {
      score = 85
      level = "green"
      label = "On track"
    } else if (daysSince <= cadenceDays * 1.5) {
      score = 50
      level = "yellow"
      label = "Due soon"
    } else if (daysSince <= cadenceDays * 2) {
      score = 25
      level = "orange"
      label = "Overdue"
    } else {
      score = 10
      level = "red"
      label = "Very overdue"
    }
  } else {
    // Default time-based thresholds
    if (daysSince <= 7) {
      score = 100
      level = "green"
      label = "Active"
    } else if (daysSince <= 30) {
      score = 75
      level = "green"
      label = "Good"
    } else if (daysSince <= 90) {
      score = 50
      level = "yellow"
      label = "Cooling"
    } else if (daysSince <= 180) {
      score = 25
      level = "orange"
      label = "Going cold"
    } else {
      score = 10
      level = "red"
      label = "Cold"
    }
  }

  return { score, level, label }
}

/** Compute the next_due_date for a contact based on cadence and scheduled follow-up */
export function computeNextDueDate(
  lastContactDate: string | null,
  createdAt: string,
  cadenceDays: number | null,
  scheduledFollowUp: string | null
): string | null {
  // Scheduled follow-up takes priority if it's in the future
  if (scheduledFollowUp) {
    const followUpDate = new Date(scheduledFollowUp)
    if (followUpDate >= new Date(new Date().toISOString().split("T")[0])) {
      return scheduledFollowUp
    }
  }

  // Recurring cadence
  if (cadenceDays && cadenceDays >= 1) {
    const ref = lastContactDate || createdAt
    const refDate = new Date(ref)
    refDate.setDate(refDate.getDate() + cadenceDays)
    return refDate.toISOString().split("T")[0]
  }

  return null
}

export const HEALTH_COLORS: Record<HealthLevel, { bg: string; text: string; dot: string }> = {
  green: {
    bg: "bg-green-700",
    text: "text-white",
    dot: "bg-white",
  },
  yellow: {
    bg: "bg-yellow-400",
    text: "text-yellow-950",
    dot: "bg-yellow-900",
  },
  orange: {
    bg: "bg-orange-700",
    text: "text-white",
    dot: "bg-white",
  },
  red: {
    bg: "bg-red-700",
    text: "text-white",
    dot: "bg-white",
  },
}
