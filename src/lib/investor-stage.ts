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
// Every alternative is word-bounded so "Passive" or "Deadline Q3" don't
// read as passed. Ambiguous words ("closed", "signed", "lead") are left out:
// a wrong stage is worse than none, since stages feed the shared snapshot.
// A null stage means "recognized, but deliberately not mapped".
const STAGE_PATTERNS: Array<[RegExp, InvestorStage | null]> = [
  // Negations first: "Not contacted" must not match "contacted".
  [/\b(not (yet )?(contacted|reached out|emailed)|uncontacted|to contact)\b/, "researching"],
  // Silence after outreach is not a pass.
  [/\bno (response|reply|answer)( yet)?\b/, "intro_made"],
  // Negated progress ("No meeting yet", "Not met yet") is neither a pass nor a meeting.
  [/\b(no(t)? (yet )?(met|meeting|mtg|intro(duction)?|call)( yet)?|haven'?t met)\b/, null],
  [/\b(pass|passed|declined?|no|not a fit|dead|lost|rejected)\b/, "passed"],
  // Interest that isn't a commitment ("soft yes", "maybe") stays unmapped.
  [/\b(soft (yes|commit(ment)?)|maybe|interested)\b/, null],
  // A term sheet or verbal yes is a commitment in the template's terms.
  [/\b(committed|commit|invested|wired|hard (yes|commit)|term ?sheet|ts|verbal( yes)?)\b/, "committed"],
  [/\b(due diligence|diligence|dd|data room)\b/, "diligence"],
  [/\b(partner (meeting|mtg|call|pitch)|ic|investment committee|second meeting|2nd meeting|follow[- ]?up meeting)\b/, "partner_meeting"],
  [/\b(intro(duction)? requested|requested (an )?intro|asked for (an )?intro|warm intro pending|awaiting intro)\b/, "intro_requested"],
  [/\b((first|1st|intro(ductory)?) (meeting|mtg|call|chat)|met|meeting|pitched)\b/, "first_meeting"],
  // Intro sent, or cold outreach out and awaiting a reply.
  [/\b(intro(duction)? (made|sent|done)|introduced|contacted|reached out|emailed|messaged|outreach|cold email(ed)?)\b/, "intro_made"],
  [/\b(research|researching|target|prospect|identified|backlog)\b/, "researching"],
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
