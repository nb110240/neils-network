import { type HealthScore, type HealthLevel } from "@/lib/types"

export function calculateHealthScore(lastContactDate: string | null, createdAt: string): HealthScore {
  const referenceDate = lastContactDate || createdAt
  const daysSince = Math.floor(
    (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  let score: number
  let level: HealthLevel
  let label: string

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

  return { score, level, label }
}

export const HEALTH_COLORS: Record<HealthLevel, { bg: string; text: string; dot: string }> = {
  green: {
    bg: "bg-green-500",
    text: "text-white",
    dot: "bg-white",
  },
  yellow: {
    bg: "bg-yellow-400",
    text: "text-yellow-950",
    dot: "bg-yellow-900",
  },
  orange: {
    bg: "bg-orange-500",
    text: "text-white",
    dot: "bg-white",
  },
  red: {
    bg: "bg-red-500",
    text: "text-white",
    dot: "bg-white",
  },
}
