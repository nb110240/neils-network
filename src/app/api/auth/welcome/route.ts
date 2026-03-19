import { NextResponse } from "next/server"
import { Resend } from "resend"

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function POST(request: Request) {
  try {
    // Protect with internal secret — only callable from auth callback
    const authHeader = request.headers.get("x-internal-secret")
    if (authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const { email, name } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "Email is required" }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const userName = name || "there"

    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Savvo <hello@savvo.app>",
      to: email,
      subject: "Welcome to Savvo",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="font-size:22px;font-weight:600;color:#1c1917;margin:0">Savvo</h1>
            <p style="color:#78716c;margin:4px 0 0;font-size:14px">Keep every connection alive.</p>
          </div>
          <p style="font-size:15px;color:#1c1917">Hey ${escapeHtml(userName)},</p>
          <p style="font-size:15px;color:#44403c;line-height:1.6">
            Welcome to Savvo! Here's how to get started:
          </p>
          <div style="margin:20px 0">
            <div style="padding:14px 16px;border:1px solid #e7e5e4;border-radius:12px;margin-bottom:10px">
              <strong style="font-size:14px;color:#1c1917">1. Add your first contact</strong>
              <p style="color:#78716c;font-size:13px;margin:4px 0 0">
                Paste your meeting notes and we'll extract everything automatically.
              </p>
            </div>
            <div style="padding:14px 16px;border:1px solid #e7e5e4;border-radius:12px;margin-bottom:10px">
              <strong style="font-size:14px;color:#1c1917">2. Try semantic search</strong>
              <p style="color:#78716c;font-size:13px;margin:4px 0 0">
                Search your network by context, not just names.
              </p>
            </div>
            <div style="padding:14px 16px;border:1px solid #e7e5e4;border-radius:12px">
              <strong style="font-size:14px;color:#1c1917">3. Check your health scores</strong>
              <p style="color:#78716c;font-size:13px;margin:4px 0 0">
                We'll track your relationships and nudge you when someone's going cold.
              </p>
            </div>
          </div>
          <div style="text-align:center;margin-top:24px">
            <a href="${appUrl}/dashboard" style="display:inline-block;padding:10px 28px;background:#c2410c;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">
              Open Savvo
            </a>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Welcome email error:", error)
    return NextResponse.json({ message: "Failed to send welcome email" }, { status: 500 })
  }
}
