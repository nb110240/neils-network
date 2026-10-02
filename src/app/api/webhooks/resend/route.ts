import { NextResponse, after } from "next/server"
import { revalidatePath } from "next/cache"
import { Resend } from "resend"
import { analyzeInteraction } from "@/lib/action-extraction"
import { createServiceClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import {
  extractEmailAddress,
  hashMeetingContent,
  htmlToPlainText,
  normalizeMeetingText,
} from "@/lib/meeting-content"
import { log } from "@/lib/logger"
import { sendPushToUser } from "@/lib/push/send"
import { forwardedNotesMessage } from "@/lib/push/messages"

function webhookHeaders(request: Request) {
  return {
    id: request.headers.get("svix-id") || "",
    timestamp: request.headers.get("svix-timestamp") || "",
    signature: request.headers.get("svix-signature") || "",
  }
}

function tokenFromRecipients(recipients: string[], expectedDomain: string): string | null {
  for (const recipient of recipients) {
    const address = extractEmailAddress(recipient)
    if (!address) continue
    const at = address.lastIndexOf("@")
    const local = address.slice(0, at)
    const domain = address.slice(at + 1)
    if (domain !== expectedDomain || !/^notes-[a-f0-9]{48}$/.test(local)) continue
    return local.slice("notes-".length)
  }
  return null
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  const receivingDomain = process.env.RESEND_RECEIVING_DOMAIN?.trim().toLowerCase().replace(/^@/, "")
  const apiKey = process.env.RESEND_API_KEY
  if (!webhookSecret || !receivingDomain || !apiKey) {
    log("error", "Resend inbound webhook is not configured", {
      action: "webhook.received",
      route: "/api/webhooks/resend",
    })
    return NextResponse.json({ error: "Inbound email is not configured" }, { status: 503 })
  }

  const payload = await request.text()
  const resend = new Resend(apiKey)
  let event: ReturnType<typeof resend.webhooks.verify>
  try {
    const headers = webhookHeaders(request)
    if (!headers.id || !headers.timestamp || !headers.signature) throw new Error("Missing signature headers")
    event = resend.webhooks.verify({ payload, headers, webhookSecret })
  } catch (error) {
    log("warn", "Invalid Resend webhook signature", {
      action: "webhook.invalid_signature",
      route: "/api/webhooks/resend",
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ received: true, processed: false })
  }

  try {
    const aliasToken = tokenFromRecipients(event.data.to, receivingDomain)
    if (!aliasToken) return NextResponse.json({ received: true, processed: false })

    const service = await createServiceClient()
    const { data: alias } = await service
      .from("inbound_aliases")
      .select("user_id")
      .eq("alias_token", aliasToken)
      .eq("enabled", true)
      .maybeSingle()

    if (!alias?.user_id) return NextResponse.json({ received: true, processed: false })
    if ((await getUserPlan(alias.user_id)) === "free") {
      return NextResponse.json({ received: true, processed: false, reason: "upgrade_required" })
    }

    const { data: authData } = await service.auth.admin.getUserById(alias.user_id)
    const accountEmail = authData.user?.email?.toLowerCase()
    if (!accountEmail) return NextResponse.json({ received: true, processed: false })

    // Only the account owner may trigger paid analysis through this address.
    // This prevents a leaked alias from becoming an unbounded AI-spend vector.
    const sender = extractEmailAddress(event.data.from)
    if (sender !== accountEmail) {
      log("warn", "Inbound notes rejected because sender did not match account", {
        action: "webhook.customer_mismatch",
        route: "/api/webhooks/resend",
        userId: alias.user_id,
      })
      return NextResponse.json({ received: true, processed: false })
    }

    const { data: duplicate } = await service
      .from("after_call_reviews")
      .select("id")
      .eq("user_id", alias.user_id)
      .eq("source", "forwarded_email")
      .eq("external_source_id", event.data.email_id)
      .maybeSingle()
    if (duplicate) return NextResponse.json({ received: true, processed: true, deduplicated: true })

    const received = await resend.emails.receiving.get(event.data.email_id)
    if (received.error || !received.data) {
      throw new Error(received.error?.message || "Resend did not return the email body")
    }

    const rawText = normalizeMeetingText(
      (received.data.text || (received.data.html ? htmlToPlainText(received.data.html) : "")).slice(0, 100000)
    )
    if (rawText.length < 20) {
      return NextResponse.json({ received: true, processed: false, reason: "not_enough_text" })
    }

    const title = (received.data.subject || "Forwarded meeting notes").trim().slice(0, 200)
    const occurredAt = received.data.created_at || event.created_at
    const analysis = await analyzeInteraction({
      rawText,
      title,
      occurredAt,
      userName: accountEmail.split("@")[0] || null,
    })

    const { data: review, error } = await service
      .from("after_call_reviews")
      .insert({
        user_id: alias.user_id,
        contact_id: null,
        source: "forwarded_email",
        external_source_id: event.data.email_id,
        title,
        occurred_at: occurredAt,
        raw_text: rawText,
        content_hash: hashMeetingContent(rawText),
        summary: analysis.summary,
        proposed_contact_patch: analysis.contactPatch,
        proposed_commitments: analysis.commitments,
        proposed_follow_up: analysis.followUpDraft,
      })
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ received: true, processed: true, deduplicated: true })
      }
      throw new Error(error.message)
    }

    revalidatePath("/dashboard")
    revalidatePath("/inbox")
    if (review?.id) {
      const reviewId = review.id as string
      after(() => sendPushToUser(service, alias.user_id, forwardedNotesMessage(title, reviewId)))
    }
    log("info", "Forwarded meeting notes added to approval inbox", {
      action: "webhook.received",
      route: "/api/webhooks/resend",
      userId: alias.user_id,
      reviewId: review?.id,
    })
    return NextResponse.json({ received: true, processed: true })
  } catch (error) {
    log("error", "Failed to process forwarded meeting notes", {
      action: "webhook.received",
      route: "/api/webhooks/resend",
      error: error instanceof Error ? error.message : String(error),
    })
    // A 500 asks Resend to retry transient retrieval, model, or database failures.
    return NextResponse.json({ error: "Could not process inbound email" }, { status: 500 })
  }
}
