import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { createServiceClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"

function receivingDomain(): string | null {
  const value = process.env.RESEND_RECEIVING_DOMAIN?.trim().toLowerCase().replace(/^@/, "")
  return value && /^[a-z0-9.-]+$/.test(value) ? value : null
}

function addressFor(token: string, domain: string): string {
  return `notes-${token}@${domain}`
}

async function requirePaidUser(userId: string) {
  return (await getUserPlan(userId)) !== "free"
}

export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user } = auth

    if (!(await requirePaidUser(user.id))) {
      return NextResponse.json({ available: false, requires_upgrade: true })
    }

    const domain = receivingDomain()
    if (!domain || !process.env.RESEND_WEBHOOK_SECRET) {
      return NextResponse.json({ available: false, requires_upgrade: false })
    }

    const service = await createServiceClient()
    let { data: alias, error } = await service
      .from("inbound_aliases")
      .select("alias_token, enabled")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) return errorResponse("Could not load your forwarding address")

    if (!alias) {
      const created = await service
        .from("inbound_aliases")
        .insert({ user_id: user.id, alias_token: randomBytes(24).toString("hex") })
        .select("alias_token, enabled")
        .single()
      alias = created.data
      error = created.error
    }

    if (error || !alias) return errorResponse("Could not create your forwarding address")
    return NextResponse.json({
      available: true,
      enabled: alias.enabled,
      address: alias.enabled ? addressFor(alias.alias_token, domain) : null,
    })
  } catch (error) {
    console.error("Inbound address GET error:", error)
    return errorResponse("Could not load your forwarding address")
  }
}

export async function POST() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user } = auth

    if (!(await requirePaidUser(user.id))) {
      return NextResponse.json({ error: "Forwarded meeting notes are a Pro feature" }, { status: 403 })
    }

    const domain = receivingDomain()
    if (!domain || !process.env.RESEND_WEBHOOK_SECRET) {
      return errorResponse("Forwarded meeting notes are not configured yet", 503)
    }

    const service = await createServiceClient()
    const { data: alias, error } = await service
      .from("inbound_aliases")
      .upsert(
        {
          user_id: user.id,
          alias_token: randomBytes(24).toString("hex"),
          enabled: true,
        },
        { onConflict: "user_id" }
      )
      .select("alias_token")
      .single()

    if (error || !alias) return errorResponse("Could not rotate your forwarding address")
    return NextResponse.json({
      available: true,
      enabled: true,
      address: addressFor(alias.alias_token, domain),
    })
  } catch (error) {
    console.error("Inbound address POST error:", error)
    return errorResponse("Could not rotate your forwarding address")
  }
}

export async function DELETE() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user } = auth
    const service = await createServiceClient()
    const { error } = await service
      .from("inbound_aliases")
      .update({ enabled: false })
      .eq("user_id", user.id)

    if (error) return errorResponse("Could not disable your forwarding address")
    return NextResponse.json({ available: true, enabled: false, address: null })
  } catch (error) {
    console.error("Inbound address DELETE error:", error)
    return errorResponse("Could not disable your forwarding address")
  }
}
