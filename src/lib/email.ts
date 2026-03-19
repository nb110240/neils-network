import { Resend } from "resend"

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

interface DigestContact {
  name: string | null
  company: string | null
  how_we_met: string | null
  last_contact_date: string | null
  id: string
}

export async function sendDigestEmail(
  to: string,
  userName: string,
  contacts: DigestContact[]
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const contactRows = contacts
    .map((c) => {
      const name = c.name || "Unknown"
      const company = c.company ? ` at ${c.company}` : ""
      const lastContact = c.last_contact_date
        ? new Date(c.last_contact_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Never"
      const context = c.how_we_met
        ? `<p style="color:#78716c;font-size:13px;margin:4px 0 0">${escapeHtml(c.how_we_met)}</p>`
        : ""
      return `
        <div style="padding:16px;border:1px solid #e7e5e4;border-radius:12px;margin-bottom:12px">
          <div>
            <strong style="font-size:15px">${escapeHtml(name)}</strong><span style="color:#78716c">${escapeHtml(company)}</span>
            ${context}
            <p style="color:#a8a29e;font-size:12px;margin:4px 0 0">Last contact: ${lastContact}</p>
          </div>
          <a href="${appUrl}/contact/${c.id}" style="display:inline-block;margin-top:10px;padding:6px 16px;background:#c2410c;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:500">Log interaction</a>
        </div>`
    })
    .join("")

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Savvo <digest@savvo.app>",
    to,
    subject: `${contacts.length} relationships need your attention`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="font-size:22px;font-weight:600;color:#1c1917;margin:0">Savvo</h1>
          <p style="color:#78716c;margin:4px 0 0;font-size:14px">Your daily relationship check-in</p>
        </div>
        <p style="font-size:15px;color:#1c1917">Hey ${escapeHtml(userName)},</p>
        <p style="font-size:15px;color:#44403c">These relationships could use some attention:</p>
        ${contactRows}
        <p style="font-size:13px;color:#a8a29e;text-align:center;margin-top:24px">
          You're receiving this because you have a Savvo Pro account.<br/>
          <a href="${appUrl}/dashboard" style="color:#c2410c">Open Savvo</a>
        </p>
      </div>
    `,
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
