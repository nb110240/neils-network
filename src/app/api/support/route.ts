import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"
import { Resend } from "resend"
import { escapeHtml, emailLayout } from "@/lib/email"

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("auth")
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const { subject, message } = await request.json()

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return badRequestResponse("Please write a message (at least 5 characters)")
    }

    if (!subject || typeof subject !== "string") {
      return badRequestResponse("Please select a topic")
    }

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const resend = new Resend(resendKey)

      const body = `
        <p style="font-size:16px;font-weight:600;color:#1c1917;margin:0 0 16px">New Support Message</p>
        <div style="padding:16px;border:1px solid #e7e5e4;border-radius:12px;background:white;margin-bottom:16px">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#78716c;width:80px">From</td><td style="padding:8px 0">${escapeHtml(user.email || "")}</td></tr>
            <tr><td style="padding:8px 0;color:#78716c">User ID</td><td style="padding:8px 0;font-family:monospace;font-size:12px">${user.id}</td></tr>
            <tr><td style="padding:8px 0;color:#78716c">Topic</td><td style="padding:8px 0">${escapeHtml(subject)}</td></tr>
          </table>
        </div>
        <div style="padding:16px;background:white;border:1px solid #e7e5e4;border-radius:12px;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</div>
      `

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Savvo <support@savvo.app>",
        to: "neilbajaj72@gmail.com",
        subject: `[Savvo Support] ${subject}`,
        html: emailLayout({
          subtitle: "Support Message",
          body,
          showUnsubscribe: false,
        }),
        replyTo: user.email || undefined,
      })
    } else {
      console.log("SUPPORT MESSAGE:", { from: user.email, subject, message })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Support error:", error)
    return errorResponse("Failed to send message")
  }
}
