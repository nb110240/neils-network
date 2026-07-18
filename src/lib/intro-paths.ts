export type IntroPathConfidence = "verified" | "possible" | "context_only"

export interface IntroPathContact {
  id: string
  name: string | null
  company: string | null
  job_title: string | null
  how_we_met: string | null
  next_steps: string | null
  raw_note: string | null
  last_contact_date: string | null
  created_at: string
  tags: string[]
}

export interface RankedIntroPath {
  connector: IntroPathContact
  score: number
  confidence: IntroPathConfidence
  evidence: string
  reason: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function normalized(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase()
}

export function rankIntroPaths(
  target: IntroPathContact,
  candidates: IntroPathContact[],
  nowMs = Date.now()
): RankedIntroPath[] {
  const targetName = normalized(target.name)
  const targetCompany = normalized(target.company)
  const targetTags = new Set(target.tags.map(normalized).filter(Boolean))

  return candidates.flatMap((connector): RankedIntroPath[] => {
    if (connector.id === target.id) return []
    const context = normalized([
      connector.how_we_met,
      connector.next_steps,
      connector.raw_note,
    ].filter(Boolean).join(" "))
    const connectorCompany = normalized(connector.company)
    const sharedTags = connector.tags.filter((tag) => targetTags.has(normalized(tag)))
    const evidence: string[] = []
    let confidence: IntroPathConfidence = "context_only"
    let score = 0

    const relationshipPattern = targetName
      ? new RegExp(`\\b(knows|worked with|introduced by|connected to|referred by|colleague of)\\b.{0,80}${targetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${targetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.{0,80}\\b(knows|worked with|introduced|connected|referred|colleague)\\b`, "i")
      : null
    if (relationshipPattern?.test(context)) {
      score += 75
      confidence = "verified"
      evidence.push(`Your notes describe a relationship with ${target.name || "the target"}.`)
    } else if (targetName && context.includes(targetName)) {
      score += 48
      confidence = "possible"
      evidence.push(`Your notes mention ${target.name}. Confirm they know each other before asking.`)
    }

    if (targetCompany && connectorCompany === targetCompany) {
      score += 45
      if (confidence === "context_only") confidence = "possible"
      evidence.push(`Both contacts are listed at ${target.company}.`)
    } else if (targetCompany && context.includes(targetCompany)) {
      score += 30
      if (confidence === "context_only") confidence = "possible"
      evidence.push(`Your notes mention ${target.company}.`)
    }

    if (sharedTags.length > 0) {
      score += Math.min(18, sharedTags.length * 6)
      evidence.push(`Shared context: ${sharedTags.slice(0, 3).join(", ")}.`)
    }

    if (evidence.length === 0) return []
    const reference = connector.last_contact_date || connector.created_at
    const daysSince = Math.max(0, Math.floor((nowMs - new Date(reference).getTime()) / DAY_MS))
    score += Math.max(0, 15 - Math.floor(daysSince / 30))

    return [{
      connector,
      score: Math.min(100, score),
      confidence,
      evidence: evidence.join(" "),
      reason: confidence === "verified"
        ? "Your CRM has explicit relationship evidence."
        : confidence === "possible"
          ? "This is a plausible path, but confirm the relationship first."
          : "This is contextual fit, not proof of a warm path.",
    }]
  }).sort((a, b) => b.score - a.score || a.connector.id.localeCompare(b.connector.id))
}
