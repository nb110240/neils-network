import type { SupabaseClient } from "@supabase/supabase-js"
import { INVESTOR_STAGES, investorStageLabel } from "@/lib/investor-stage"
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email"
import { fetchAllRows } from "@/lib/fetch-all"

// ─── Weekly pipeline email ───
// Every Monday, a founder's co-founder or advisor gets the state of the raise:
// stage counts, who they met this week, and who is in late-stage talks.
// Investor names, firms and stages only: notes, emails and meeting content
// never leave the founder's account.

export const MAX_PIPELINE_RECIPIENTS = 3
export const PIPELINE_WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
/** Stages listed by name as "late-stage conversations". */
const LATE_STAGES = new Set(["partner_meeting", "diligence", "committed"])
/** Cap each named list so a 500-investor pipeline stays a short email. */
const LIST_LIMIT = 12

export interface PipelineInvestor {
  id: string
  name: string | null
  company: string | null
  investor_stage: string
}

export interface PipelineDigest {
  founderName: string
  stages: Array<{ value: string; label: string; count: number }>
  active: number
  committed: number
  passed: number
  metThisWeek: PipelineInvestor[]
  lateStage: PipelineInvestor[]
}

/**
 * Pure: turn a founder's investor contacts and this week's meetings into the
 * digest. Returns null when there is no pipeline to report.
 */
export function buildPipelineDigest(input: {
  founderName: string
  investors: PipelineInvestor[]
  meetingContactIds: Iterable<string>
}): PipelineDigest | null {
  const investors = input.investors.filter((c) => INVESTOR_STAGES.some((s) => s.value === c.investor_stage))
  if (investors.length === 0) return null
  const counts = new Map<string, number>()
  for (const c of investors) counts.set(c.investor_stage, (counts.get(c.investor_stage) ?? 0) + 1)
  const met = new Set(input.meetingContactIds)
  const byName = (a: PipelineInvestor, b: PipelineInvestor) => (a.name || "").localeCompare(b.name || "")
  const stageRank = (stage: string) => INVESTOR_STAGES.findIndex((s) => s.value === stage)
  return {
    founderName: input.founderName,
    stages: INVESTOR_STAGES.map((s) => ({ value: s.value, label: s.label, count: counts.get(s.value) ?? 0 })),
    active: investors.filter((c) => c.investor_stage !== "passed").length,
    committed: counts.get("committed") ?? 0,
    passed: counts.get("passed") ?? 0,
    metThisWeek: investors.filter((c) => met.has(c.id)).sort(byName),
    lateStage: investors
      .filter((c) => LATE_STAGES.has(c.investor_stage))
      .sort((a, b) => stageRank(b.investor_stage) - stageRank(a.investor_stage) || byName(a, b)),
  }
}

export function pipelineDigestSubject(digest: PipelineDigest): string {
  const parts = [`${digest.active} active`]
  if (digest.committed > 0) parts.push(`${digest.committed} committed`)
  return `${digest.founderName}'s raise this week: ${parts.join(", ")}`
}

function investorList(title: string, investors: PipelineInvestor[]): string {
  if (investors.length === 0) return ""
  const shown = investors.slice(0, LIST_LIMIT)
  const more = investors.length - shown.length
  const rows = shown
    .map((c) => {
      const who = escapeHtml(c.name || "Unnamed investor")
      const firm = c.company ? ` <span style="color:#57534e">· ${escapeHtml(c.company)}</span>` : ""
      const stage = escapeHtml(investorStageLabel(c.investor_stage) || "")
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #f5f5f4">${who}${firm}</td><td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;color:#57534e;white-space:nowrap">${stage}</td></tr>`
    })
    .join("")
  return `
    <p style="font-size:13px;font-weight:600;color:#1c1917;margin:24px 0 4px;text-transform:uppercase;letter-spacing:0.5px">${title}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
    ${more > 0 ? `<p style="font-size:13px;color:#57534e;margin:6px 0 0">and ${more} more</p>` : ""}`
}

/** The email body (inside emailLayout). Every user-supplied string is escaped. */
export function renderPipelineDigestBody(digest: PipelineDigest, options: { founderEmail: string }): string {
  const founder = escapeHtml(digest.founderName)
  const funnel = digest.stages
    .filter((s) => s.count > 0)
    .map((s) => `<tr><td style="padding:6px 0;color:#44403c">${escapeHtml(s.label)}</td><td style="padding:6px 0;text-align:right;font-weight:600">${s.count}</td></tr>`)
    .join("")
  const metLine = digest.metThisWeek.length > 0
    ? investorList(`Met this week (${digest.metThisWeek.length})`, digest.metThisWeek)
    : `<p style="font-size:14px;color:#57534e;margin:24px 0 0">No investor meetings logged this week.</p>`
  return `
    <p style="margin:0 0 16px">${founder} shares their fundraising pipeline with you every Monday.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px"><tr>
      <td style="padding:14px;border:1px solid #e7e5e4;border-radius:12px;text-align:center;background:#ffffff"><div style="font-size:24px;font-weight:600">${digest.active}</div><div style="font-size:12px;color:#57534e">active</div></td>
      <td style="width:8px"></td>
      <td style="padding:14px;border:1px solid #e7e5e4;border-radius:12px;text-align:center;background:#ffffff"><div style="font-size:24px;font-weight:600;color:#c2410c">${digest.committed}</div><div style="font-size:12px;color:#57534e">committed</div></td>
      <td style="width:8px"></td>
      <td style="padding:14px;border:1px solid #e7e5e4;border-radius:12px;text-align:center;background:#ffffff"><div style="font-size:24px;font-weight:600">${digest.passed}</div><div style="font-size:12px;color:#57534e">passed</div></td>
    </tr></table>
    <p style="font-size:13px;font-weight:600;color:#1c1917;margin:24px 0 4px;text-transform:uppercase;letter-spacing:0.5px">Pipeline by stage</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${funnel}</table>
    ${metLine}
    ${investorList("Late-stage conversations", digest.lateStage)}
    <p style="font-size:13px;color:#57534e;margin:28px 0 0">Reply to this email to reach ${founder} (${escapeHtml(options.founderEmail)}).</p>`
}

/** Footer for a recipient who isn't a Savvo user: who added them, and a way out. */
export function renderPipelineDigestFooter(options: { founderName: string; unsubscribeUrl: string }): string {
  return `<span style="color:#57534e">You get this because ${escapeHtml(options.founderName)} added you in Savvo.</span> <a href="${escapeHtml(options.unsubscribeUrl)}" style="color:#57534e;text-decoration:underline">Stop these emails</a>`
}

/** Reads what the digest needs. Paged past the API's 1,000-row cap. */
export async function loadPipelineData(
  service: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<{ investors: PipelineInvestor[]; meetingContactIds: string[] }> {
  const since = new Date(now.getTime() - PIPELINE_WINDOW_DAYS * DAY_MS).toISOString()
  const [investorsRes, meetingsRes] = await Promise.all([
    fetchAllRows<PipelineInvestor>((from, to) =>
      service
        .from("contacts")
        .select("id, name, company, investor_stage")
        .eq("created_by", userId)
        .is("archived_at", null)
        .not("investor_stage", "is", null)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<{ contact_id: string }>((from, to) =>
      service
        .from("contact_activities")
        .select("contact_id")
        .eq("user_id", userId)
        .eq("type", "meeting")
        .gte("occurred_at", since)
        .lte("occurred_at", now.toISOString())
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ])
  if (investorsRes.error) throw new Error(investorsRes.error.message)
  if (meetingsRes.error) throw new Error(meetingsRes.error.message)
  return {
    investors: investorsRes.data,
    meetingContactIds: meetingsRes.data.map((row) => row.contact_id),
  }
}

export function pipelineUnsubscribeUrl(token: string, appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"): string {
  return `${appUrl}/pipeline/unsubscribe/${token}`
}

export function pipelineOneClickUnsubscribeUrl(token: string, appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"): string {
  return `${appUrl}/api/pipeline-digest/unsubscribe?token=${encodeURIComponent(token)}`
}

/** Sends one recipient their copy; each carries its own unsubscribe link. */
export async function sendPipelineDigestEmail(options: {
  to: string
  unsubscribeToken: string
  digest: PipelineDigest
  founderEmail: string
}): Promise<void> {
  const { to, unsubscribeToken, digest, founderEmail } = options
  await sendEmail({
    from: process.env.RESEND_FROM_EMAIL || "Savvo <digest@savvo.app>",
    to,
    replyTo: founderEmail,
    subject: pipelineDigestSubject(digest),
    html: emailLayout({
      subtitle: "Weekly pipeline",
      body: renderPipelineDigestBody(digest, { founderEmail }),
      footerHtml: renderPipelineDigestFooter({
        founderName: digest.founderName,
        unsubscribeUrl: pipelineUnsubscribeUrl(unsubscribeToken),
      }),
    }),
    // One-click unsubscribe from the mail client itself (RFC 8058).
    headers: {
      "List-Unsubscribe": `<${pipelineOneClickUnsubscribeUrl(unsubscribeToken)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  })
}
