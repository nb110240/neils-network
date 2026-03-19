import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"
import { Resend } from "resend"

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
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Savvo <support@savvo.app>",
        to: "neilbajaj72@gmail.com",
        subject: `[Savvo Support] ${subject}`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;padding:24px">
            <h2 style="font-size:18px;color:#1c1917;margin:0 0 16px">New Support Message</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#78716c;width:80px">From</td><td style="padding:8px 0">${user.email}</td></tr>
              <tr><td style="padding:8px 0;color:#78716c">User ID</td><td style="padding:8px 0;font-family:monospace;font-size:12px">${user.id}</td></tr>
              <tr><td style="padding:8px 0;color:#78716c">Topic</td><td style="padding:8px 0">${subject}</td></tr>
            </table>
            <div style="margin-top:16px;padding:16px;background:#faf9f7;border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          </div>
        `,
        replyTo: user.email || undefined,
      })
    } else {
      // Fallback: log to console if Resend not configured
      console.log("SUPPORT MESSAGE:", { from: user.email, subject, message })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Support error:", error)
    return errorResponse("Failed to send message")
  }
}
