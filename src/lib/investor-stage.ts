// ─── Investor pipeline stages ───
// The 8 stages from the free investor tracker template
// (/templates/investor-tracker), so a founder's Status column maps 1:1.
// Ordered funnel used by the contact stage picker, CSV import, and the
// public raise snapshot. Values match the contacts.investor_stage CHECK.

export const INVESTOR_STAGES = [
  { value: "researching", label: "Researching" },
  { value: "intro_requested", label: "Intro requested" },
  { value: "intro_made", label: "Intro made" },
  { value: "first_meeting", label: "First meeting" },
  { value: "partner_meeting", label: "Partner meeting" },
  { value: "diligence", label: "Diligence" },
  { value: "committed", label: "Committed" },
  { value: "passed", label: "Passed" },
] as const

export type InvestorStage = (typeof INVESTOR_STAGES)[number]["value"]

export const INVESTOR_STAGE_VALUES = INVESTOR_STAGES.map((s) => s.value) as [InvestorStage, ...InvestorStage[]]

export function investorStageLabel(stage: string | null | undefined): string | null {
  return INVESTOR_STAGES.find((s) => s.value === stage)?.label ?? null
}

// Free-text status from spreadsheets ("First Mtg", "Intro Requested",
// "Pass", "TS") mapped onto a stage. Order matters: more specific phrases
// are checked before generic ones. Unknown text returns null rather than
// guessing, so imports never invent pipeline progress.
const STAGE_PATTERNS: Array<[RegExp, InvestorStage]> = [
  [/\b(pass(ed)?|declined?|no\b|not a fit|dead|lost|rejected)/, "passed"],
  // A term sheet or verbal yes is a commitment in the template's terms.
  [/\b(committed|commit|closed|invested|wired|signed|yes|term ?sheet|ts|verbal)\b/, "committed"],
  [/\b(due diligence|diligence|dd|data room)\b/, "diligence"],
  [/\b(partner|ic\b|investment committee|second meeting|2nd meeting|follow[- ]?up meeting)/, "partner_meeting"],
  [/\b(first|1st|intro(ductory)?) (meeting|mtg|call|chat)|\bmet\b|\bmeeting\b|\bpitched\b/, "first_meeting"],
  [/\b(intro(duction)? requested|requested intro|asked for intro|warm intro pending|awaiting intro)/, "intro_requested"],
  // Intro sent, or cold outreach out and awaiting a reply.
  [/\b(intro(duction)? (made|sent|done)|introduced|contacted|reached out|emailed|messaged|outreach|cold email)/, "intro_made"],
  [/\b(research(ing)?|target|to contact|prospect|identified|backlog|not contacted|lead)/, "researching"],
]

export function normalizeInvestorStage(value: string | null | undefined): InvestorStage | null {
  if (!value) return null
  const text = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  if (!text) return null
  const exact = INVESTOR_STAGES.find((s) => s.value === text.replace(/ /g, "_") || s.label.toLowerCase() === text)
  if (exact) return exact.value
  for (const [pattern, stage] of STAGE_PATTERNS) {
    if (pattern.test(text)) return stage
  }
  return null
}

export interface StageSummary {
  rows: Array<{ value: InvestorStage; label: string; count: number }>
  /** Investors in play: every stage except passed. */
  active: number
  committed: number
  passed: number
}

/** Ordered counts for the funnel, ignoring unknown stage keys. */
export function summarizeStages(counts: Record<string, number> | null | undefined): StageSummary {
  const safe = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)
  const rows = INVESTOR_STAGES.map((stage) => ({ ...stage, count: safe(counts?.[stage.value]) }))
  const passed = rows.find((r) => r.value === "passed")?.count ?? 0
  const committed = rows.find((r) => r.value === "committed")?.count ?? 0
  const active = rows.reduce((sum, r) => sum + r.count, 0) - passed
  return { rows, active, committed, passed }
}
