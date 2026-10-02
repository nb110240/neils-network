import { type DigestMoves, hasDigestMoves } from "@/lib/digest-moves"
import { Resend } from "resend"

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

type SendPayload = Parameters<Resend["emails"]["send"]>[0]

/**
 * Sends via Resend and throws on failure. The SDK reports API errors as
 * `{ error }` instead of throwing, so a bare `await emails.send()` treats a
 * rejected send as delivered (the digest then logged it and hid those
 * contacts for 14 days).
 */
export async function sendEmail(payload: SendPayload): Promise<void> {
  const result = await getResend().emails.send(payload)
  if (result?.error) {
    throw new Error(`Resend send failed: ${result.error.message}`)
  }
}

interface DigestContact {
  name: string | null
  company: string | null
  job_title: string | null
  how_we_met: string | null
  next_steps: string | null
  last_contact_date: string | null
  follow_up_needed: boolean
  id: string
  health: { score: number; level: string; label: string }
  lastActivity?: { type: string; content: string; occurred_at: string } | null
}

interface DigestStats {
  totalContacts: number
  healthBreakdown: Record<string, number>
  followUpCount: number
  isPro: boolean
  isWeekly: boolean
  /** Promises, overdue asks, pending reviews and intro follow-ups. */
  moves?: DigestMoves
}

function shortDue(dueAt: string | null, overdue: boolean): string {
  if (!dueAt) return ""
  const label = new Date(dueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  return overdue ? `overdue since ${label}` : `due ${label}`
}

export function renderDigestMoves(moves: DigestMoves, appUrl: string): string {
  if (!hasDigestMoves(moves)) return ""
  const row = (text: string, href: string, meta: string, accent: string) => `
    <div style="padding:10px 14px;border:1px solid #e7e5e4;border-left:3px solid ${accent};border-radius:10px;margin-bottom:8px">
      <a href="${href}" style="color:#1c1917;text-decoration:none;font-size:14px">${text}</a>
      ${meta ? `<p style="color:#78716c;font-size:12px;margin:3px 0 0">${meta}</p>` : ""}
    </div>`

  const promises = moves.promises
    .map((p) => row(
      `You promised <strong>${escapeHtml(p.contactName)}</strong>: ${escapeHtml(p.title)}`,
      `${appUrl}/contact/${p.contactId}`,
      shortDue(p.dueAt, p.overdue),
      p.overdue ? "#ef4444" : "#c2410c",
    ))
    .join("")
  const waiting = moves.waitingOn
    .map((w) => row(
      `<strong>${escapeHtml(w.contactName)}</strong> owes you: ${escapeHtml(w.title)}`,
      `${appUrl}/contact/${w.contactId}`,
      `${shortDue(w.dueAt, true)}. A gentle nudge keeps it moving.`,
      "#eab308",
    ))
    .join("")
  const intros = moves.introFollowUps
    .map((i) => row(
      `Follow up on your intro to <strong>${escapeHtml(i.targetName)}</strong>${i.connectorName ? ` via ${escapeHtml(i.connectorName)}` : ""}`,
      `${appUrl}/intros`,
      "",
      "#c2410c",
    ))
    .join("")
  const reviews = moves.pendingReviews > 0
    ? row(
        `${moves.pendingReviews} meeting ${moves.pendingReviews === 1 ? "note is" : "notes are"} waiting for your review`,
        `${appUrl}/inbox`,
        "Approve to update contacts and track the promises made.",
        "#78716c",
      )
    : ""

  return `
    <p style="font-size:13px;font-weight:600;color:#1c1917;margin:0 0 8px">Your moves</p>
    ${promises}${waiting}${intros}${reviews}
    <div style="height:12px"></div>`
}

export function digestSubject(contactCount: number, moves: DigestMoves | undefined, isWeekly: boolean): string {
  const first = moves?.promises[0]
  if (first) {
    const due = shortDue(first.dueAt, first.overdue)
    const more = moves.promises.length > 1 ? ` (+${moves.promises.length - 1} more)` : ""
    return `You promised ${first.contactName}: ${first.title}${due ? `, ${due}` : ""}${more}`
  }
  if (contactCount === 0 && moves && hasDigestMoves(moves)) return "Your moves for today"
  return isWeekly
    ? `Your weekly network check-in: ${contactCount} relationships need attention`
    : `${contactCount} relationships need your attention`
}

function healthColor(level: string): string {
  switch (level) {
    case "green": return "#22c55e"
    case "yellow": return "#eab308"
    case "orange": return "#f97316"
    case "red": return "#ef4444"
    default: return "#a8a29e"
  }
}

function daysSinceText(date: string | null): string {
  if (!date) return "Never contacted"
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)}+ years ago`
}

export async function sendDigestEmail(
  to: string,
  userName: string,
  contacts: DigestContact[],
  stats?: DigestStats
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"
  const isPro = stats?.isPro ?? true
  const isWeekly = stats?.isWeekly ?? false

  const contactRows = contacts
    .map((c) => {
      const name = c.name || "Unknown"
      const role = [c.job_title, c.company].filter(Boolean).join(" at ")
      const lastContact = daysSinceText(c.last_contact_date)
      const color = healthColor(c.health.level)

      // Build context line
      let contextLine = ""
      if (c.lastActivity) {
        const activityDate = new Date(c.lastActivity.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        const snippet = c.lastActivity.content.length > 80
          ? c.lastActivity.content.slice(0, 80) + "…"
          : c.lastActivity.content
        contextLine = `<p style="color:#78716c;font-size:12px;margin:6px 0 0;padding:8px;background:#fafaf9;border-radius:6px">📝 <strong>${c.lastActivity.type}</strong> on ${activityDate}: ${escapeHtml(snippet)}</p>`
      } else if (c.how_we_met) {
        const snippet = c.how_we_met.length > 80 ? c.how_we_met.slice(0, 80) + "…" : c.how_we_met
        contextLine = `<p style="color:#78716c;font-size:12px;margin:6px 0 0">Met: ${escapeHtml(snippet)}</p>`
      }

      // Next steps reminder
      const nextStepsLine = c.next_steps
        ? `<p style="color:#c2410c;font-size:12px;margin:4px 0 0;font-weight:500">→ ${escapeHtml(c.next_steps.length > 60 ? c.next_steps.slice(0, 60) + "…" : c.next_steps)}</p>`
        : ""

      return `
        <div style="padding:16px;border:1px solid #e7e5e4;border-radius:12px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
            <strong style="font-size:15px">${escapeHtml(name)}</strong>
            <span style="color:#a8a29e;font-size:12px;margin-left:auto">${c.health.label}</span>
          </div>
          ${role ? `<p style="color:#78716c;font-size:13px;margin:2px 0 0">${escapeHtml(role)}</p>` : ""}
          <p style="color:#a8a29e;font-size:12px;margin:4px 0 0">Last contact: ${lastContact}</p>
          ${contextLine}
          ${nextStepsLine}
          <div style="margin-top:12px">
            <a href="${appUrl}/contact/${c.id}" style="display:inline-block;padding:6px 16px;background:#c2410c;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:500">View &amp; follow up</a>
          </div>
        </div>`
    })
    .join("")

  // Network health summary bar
  let networkSummary = ""
  if (stats) {
    const green = stats.healthBreakdown["green"] || 0
    const yellow = stats.healthBreakdown["yellow"] || 0
    const orange = stats.healthBreakdown["orange"] || 0
    const red = stats.healthBreakdown["red"] || 0
    const total = stats.totalContacts

    const pct = (n: number) => Math.round((n / total) * 100)

    networkSummary = `
      <div style="padding:16px;background:#fafaf9;border-radius:12px;margin-bottom:20px">
        <p style="font-size:13px;font-weight:600;color:#1c1917;margin:0 0 8px">Your Network: ${total} contacts</p>
        <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px">
          ${green > 0 ? `<div style="flex:${green};background:#22c55e;border-radius:4px"></div>` : ""}
          ${yellow > 0 ? `<div style="flex:${yellow};background:#eab308;border-radius:4px"></div>` : ""}
          ${orange > 0 ? `<div style="flex:${orange};background:#f97316;border-radius:4px"></div>` : ""}
          ${red > 0 ? `<div style="flex:${red};background:#ef4444;border-radius:4px"></div>` : ""}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:#78716c">
          <span>🟢 ${green} active (${pct(green)}%)</span>
          <span>🟡 ${yellow} cooling</span>
          <span>🔴 ${orange + red} cold</span>
        </div>
        ${stats.followUpCount > 0 ? `<p style="font-size:12px;color:#c2410c;margin:8px 0 0;font-weight:500">${stats.followUpCount} follow-up${stats.followUpCount > 1 ? "s" : ""} pending</p>` : ""}
      </div>`
  }

  // Upgrade CTA for free users
  const upgradeCta = !isPro
    ? `
      <div style="padding:16px;background:linear-gradient(135deg,#fef3c7,#fff7ed);border:1px solid #f59e0b33;border-radius:12px;margin-top:16px;text-align:center">
        <p style="font-size:14px;font-weight:600;color:#1c1917;margin:0">Get daily digests with Savvo Pro</p>
        <p style="font-size:12px;color:#78716c;margin:4px 0 12px">Plus unlimited contacts, AI drafts, network graph, and more.</p>
        <a href="${appUrl}/pricing" style="display:inline-block;padding:8px 24px;background:#c2410c;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:500">Upgrade to Pro</a>
      </div>`
    : ""

  const subjectLine = digestSubject(contacts.length, stats?.moves, isWeekly)
  const movesSection = stats?.moves ? renderDigestMoves(stats.moves, appUrl) : ""

  const subtitleText = isWeekly
    ? "Your weekly relationship check-in"
    : "Your daily relationship check-in"

  // First-time digest explainer for new users
  const healthExplainer = `
    <div style="padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;margin-bottom:20px;font-size:13px;color:#44403c">
      <p style="margin:0 0 6px;font-weight:600;color:#1c1917">How this works</p>
      <p style="margin:0">Savvo tracks how recently you interacted with each contact and assigns a health score:
        <span style="color:#22c55e">Green</span> = active (last 30 days),
        <span style="color:#eab308">Yellow</span> = cooling (31-90 days),
        <span style="color:#f97316">Orange</span> = going cold (91-180 days),
        <span style="color:#ef4444">Red</span> = at risk (180+ days).
        Below are the contacts that need attention most.</p>
    </div>`

  const bodyContent = `
    <p style="margin:0 0 4px">Hey ${escapeHtml(userName)},</p>
    ${movesSection}
    ${contacts.length > 0 ? `<p style="color:#44403c;margin:0 0 20px">These relationships could use some attention:</p>
    ${healthExplainer}` : ""}
    ${networkSummary}
    ${contactRows}
    ${upgradeCta}
  `

  await sendEmail({
    from: process.env.RESEND_FROM_EMAIL || "Savvo <digest@savvo.app>",
    to,
    subject: subjectLine,
    html: emailLayout({
      subtitle: subtitleText,
      body: bodyContent,
      appUrl,
    }),
  })
}

interface NudgeContact {
  id: string
  name: string | null
  company: string | null
  job_title: string | null
}

/**
 * Nudge email for new users with 1-4 contacts.
 * They can't get a useful digest yet (the digest needs 5+ contacts to be
 * worth sending), but they still need a recurring reason to come back during
 * the window when the habit forms. This keeps Savvo in contact with them and
 * points them at the one action that matters: adding more people.
 */
export async function sendNewUserNudgeEmail(
  to: string,
  userName: string,
  contacts: NudgeContact[]
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"
  const count = contacts.length
  const remaining = Math.max(0, 5 - count)

  const contactRows = contacts
    .map((c) => {
      const name = c.name || "Unknown"
      const role = [c.job_title, c.company].filter(Boolean).join(" at ")
      return `
        <div style="padding:12px 16px;border:1px solid #e7e5e4;border-radius:10px;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <strong style="font-size:14px">${escapeHtml(name)}</strong>
            <a href="${appUrl}/contact/${c.id}" style="color:#c2410c;text-decoration:none;font-size:12px;font-weight:500;margin-left:auto">View</a>
          </div>
          ${role ? `<p style="color:#78716c;font-size:12px;margin:3px 0 0">${escapeHtml(role)}</p>` : ""}
        </div>`
    })
    .join("")

  const progressLine =
    remaining > 0
      ? `<p style="font-size:13px;color:#c2410c;font-weight:500;margin:0 0 20px">You're ${remaining} contact${remaining > 1 ? "s" : ""} away from your first network digest.</p>`
      : ""

  const bodyContent = `
    <p style="margin:0 0 4px">Hey ${escapeHtml(userName)},</p>
    <p style="color:#44403c;margin:0 0 16px">You've added ${count} contact${count > 1 ? "s" : ""} to Savvo &mdash; nice start. Savvo gets useful once it knows your circle, so add the people you've met recently. A sentence each is enough; we'll pull out the details.</p>
    ${progressLine}
    <div style="margin:0 0 24px">
      <a href="${appUrl}/add" style="display:inline-block;padding:10px 28px;background:#c2410c;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Add a contact</a>
    </div>
    <p style="font-size:13px;font-weight:600;color:#1c1917;margin:0 0 8px">Your contacts so far</p>
    ${contactRows}
    <p style="color:#78716c;font-size:13px;margin:16px 0 0">Once you reach 5 contacts, Savvo starts sending a regular digest of who's worth reaching out to.</p>
  `

  const subject =
    count === 1
      ? "You've started your network on Savvo. Add a few more"
      : "Who else have you met recently?"

  await sendEmail({
    from: process.env.RESEND_FROM_EMAIL || "Savvo <digest@savvo.app>",
    to,
    subject,
    html: emailLayout({
      subtitle: "Build your network",
      body: bodyContent,
      appUrl,
    }),
  })
}

/**
 * Tells the founder that a connector answered their hosted intro link.
 */
export async function sendIntroResponseEmail(
  to: string,
  details: {
    accepted: boolean
    connectorName: string | null
    targetName: string | null
    note: string | null
  }
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"
  const connector = escapeHtml(details.connectorName || "Your connector")
  const target = escapeHtml(details.targetName || "your target")
  const headline = details.accepted
    ? `${connector} will introduce you to ${target}.`
    : `${connector} can't make the intro to ${target} right now.`
  const nextStep = details.accepted
    ? "Reply fast when the intro lands, and suggest two times."
    : "No harm done. Look for another path in Savvo."
  const note = details.note
    ? `<div style="padding:12px 16px;border:1px solid #e7e5e4;border-radius:10px;margin:0 0 20px;white-space:pre-wrap;color:#44403c">${escapeHtml(details.note)}</div>`
    : ""

  await sendEmail({
    from: process.env.RESEND_FROM_EMAIL || "Savvo <hello@savvo.app>",
    to,
    subject: details.accepted
      ? `${details.connectorName || "Your connector"} said yes to your intro`
      : `${details.connectorName || "Your connector"} replied to your intro request`,
    html: emailLayout({
      subtitle: "Warm introductions",
      appUrl,
      body: `
        <p style="font-size:16px;color:#1c1917;margin:0 0 12px">${headline}</p>
        ${note}
        <p style="color:#44403c;margin:0 0 20px">${nextStep}</p>
        <a href="${appUrl}/intros" style="display:inline-block;padding:10px 28px;background:#c2410c;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Open introductions</a>
      `,
    }),
  })
}

/**
 * Activation emails for confirmed accounts that have not added anyone yet.
 * Step 1 (about day 1): capture one real interaction. Step 2 (about day 3):
 * bring an existing investor list over.
 */
export async function sendActivationEmail(to: string, userName: string, step: 1 | 2) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"
  const button = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;padding:10px 28px;background:#c2410c;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">${label}</a>`

  const content = step === 1
    ? {
        subject: "Paste notes from your last meeting",
        subtitle: "Start with one conversation",
        body: `
          <p style="margin:0 0 4px">Hey ${escapeHtml(userName)},</p>
          <p style="color:#44403c;margin:0 0 16px">The fastest way to see what Savvo does: paste a few lines from your last meeting. Savvo pulls out who you met, what you promised, and when to follow up.</p>
          <p style="color:#78716c;font-size:13px;margin:0 0 20px;padding:10px 12px;background:#fafaf9;border-radius:8px">"Coffee with Maya from Northwind. She asked for our churn cohorts. I said I'd send them Friday. She'll intro me to her fintech partner."</p>
          <div style="margin:0 0 8px">${button(`${appUrl}/capture`, "Paste a meeting note")}</div>`,
      }
    : {
        subject: "Bring your investor list into Savvo",
        subtitle: "Import in under a minute",
        body: `
          <p style="margin:0 0 4px">Hey ${escapeHtml(userName)},</p>
          <p style="color:#44403c;margin:0 0 16px">Already tracking investors in a spreadsheet? Import the CSV and Savvo keeps every conversation warm: who's going cold, what you owe, and where each investor stands.</p>
          <div style="margin:0 0 16px">${button(`${appUrl}/import`, "Import a CSV")}</div>
          <p style="color:#78716c;font-size:13px;margin:0">No spreadsheet yet? Start from the <a href="${appUrl}/templates/investor-tracker" style="color:#c2410c">free investor tracker template</a>.</p>`,
      }

  await sendEmail({
    from: process.env.RESEND_FROM_EMAIL || "Savvo <hello@savvo.app>",
    to,
    subject: content.subject,
    html: emailLayout({ subtitle: content.subtitle, body: content.body, appUrl }),
  })
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Shared branded email layout for all Savvo emails.
 * Wraps content in a consistent header, body, and footer.
 */
export function emailLayout(options: {
  subtitle?: string
  body: string
  appUrl?: string
  showUnsubscribe?: boolean
}): string {
  const appUrl = options.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf9f7">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <!-- Header -->
    <div style="text-align:center;padding:24px 0 20px;border-bottom:1px solid #e7e5e4;margin-bottom:24px">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:#c2410c;margin:0;letter-spacing:0.5px">Savvo</h1>
      ${options.subtitle ? `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#78716c;margin:6px 0 0;font-size:13px;letter-spacing:0.3px">${options.subtitle}</p>` : ""}
    </div>

    <!-- Body -->
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;font-size:15px;line-height:1.6">
      ${options.body}
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #e7e5e4;margin-top:32px;padding-top:20px;text-align:center">
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#a8a29e;margin:0">
        <a href="${appUrl}/dashboard" style="color:#c2410c;text-decoration:none;font-weight:500">Open Savvo</a>
        ${options.showUnsubscribe !== false ? ` · <a href="${appUrl}/settings" style="color:#a8a29e;text-decoration:none">Email preferences</a>` : ""}
      </p>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#d6d3d1;margin:8px 0 0">
        Savvo · Your network is your net worth
      </p>
    </div>
  </div>
</body>
</html>`
}
