import { NextResponse } from "next/server"
import { escapeHtml, emailLayout, sendEmail } from "@/lib/email"
import { safeCompare } from "@/lib/api-utils"

export async function POST(request: Request) {
  try {
    // Protect with internal secret — only callable from auth callback (timing-safe)
    const authHeader = request.headers.get("x-internal-secret")
    const expectedSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET
    if (!authHeader || !expectedSecret || !safeCompare(authHeader, expectedSecret)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const { email, name } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "Email is required" }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://savvo.app"
    const userName = name || "there"

    const body = `
      <p style="margin:0 0 4px">Hey ${escapeHtml(userName)},</p>
      <p style="color:#44403c;margin:0 0 24px">
        Welcome to Savvo! Here's how to get the most out of it:
      </p>

      <div style="padding:16px 18px;border:1px solid #e7e5e4;border-radius:12px;margin-bottom:12px;background:white">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#c2410c;color:white;font-size:12px;font-weight:600;flex-shrink:0">1</span>
          <strong style="font-size:14px;color:#1c1917">Add your first contact</strong>
        </div>
        <p style="color:#78716c;font-size:13px;margin:0;padding-left:34px">
          Paste your meeting notes and we'll extract name, company, role, and context automatically.
        </p>
      </div>

      <div style="padding:16px 18px;border:1px solid #e7e5e4;border-radius:12px;margin-bottom:12px;background:white">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#c2410c;color:white;font-size:12px;font-weight:600;flex-shrink:0">2</span>
          <strong style="font-size:14px;color:#1c1917">Watch your health scores</strong>
        </div>
        <p style="color:#78716c;font-size:13px;margin:0;padding-left:34px">
          Every contact gets a health score. Green means active, red means going cold. We'll nudge you before relationships drift.
        </p>
      </div>

      <div style="padding:16px 18px;border:1px solid #e7e5e4;border-radius:12px;margin-bottom:12px;background:white">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#c2410c;color:white;font-size:12px;font-weight:600;flex-shrink:0">3</span>
          <strong style="font-size:14px;color:#1c1917">Search by context</strong>
        </div>
        <p style="color:#78716c;font-size:13px;margin:0;padding-left:34px">
          "Who was that person at the fintech conference?" Search your network by what you remember, not just names.
        </p>
      </div>

      <div style="text-align:center;margin-top:28px">
        <a href="${appUrl}/add" style="display:inline-block;padding:12px 32px;background:#c2410c;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">
          Add your first contact
        </a>
      </div>
    `

    await sendEmail({
      from: process.env.RESEND_FROM_EMAIL || "Savvo <hello@savvo.app>",
      to: email,
      subject: "Welcome to Savvo",
      html: emailLayout({
        subtitle: "Keep every connection alive",
        body,
        appUrl,
        showUnsubscribe: false,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Welcome email error:", error)
    return NextResponse.json({ message: "Failed to send welcome email" }, { status: 500 })
  }
}
