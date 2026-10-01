import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  authenticateRequest,
  authFailed,
  badRequestResponse,
  errorResponse,
  forbiddenResponse,
  isValidUUID,
  notFoundResponse,
} from "@/lib/api-utils"
import { createShareToken, introLinkUrl } from "@/lib/share-token"
import { getUserPlan } from "@/lib/subscription"

// Issues (or returns the existing) link the connector opens to accept or
// decline. Sharing a draft marks it as asked, matching "Mark asked".
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isValidUUID(id)) return badRequestResponse("Invalid introduction ID")
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth
    if ((await getUserPlan(user.id)) === "free") return forbiddenResponse("Warm intro tracking is a Pro feature")

    const { data: existing, error: readError } = await supabase
      .from("intro_requests")
      .select("id, status, share_token, connector_contact_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (readError) return errorResponse("Could not create a link for this introduction")
    if (!existing) return notFoundResponse("Introduction not found")
    if (!existing.connector_contact_id) return badRequestResponse("Choose who will make this introduction first")

    if (existing.share_token) {
      return NextResponse.json({ url: introLinkUrl(existing.share_token), request: existing })
    }

    const now = new Date()
    const updates: Record<string, unknown> = { share_token: createShareToken() }
    if (existing.status === "draft") {
      updates.status = "requested"
      updates.requested_at = now.toISOString()
      updates.next_follow_up_at = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
    }

    // The .is() guard makes a concurrent second click a no-op instead of
    // replacing a link that may already have been sent.
    const { data: updated, error } = await supabase
      .from("intro_requests")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("share_token", null)
      .select("*")
      .maybeSingle()
    if (error) return errorResponse("Could not create a link for this introduction")

    const final = updated ?? (
      await supabase.from("intro_requests").select("*").eq("id", id).eq("user_id", user.id).single()
    ).data
    if (!final?.share_token) return errorResponse("Could not create a link for this introduction")

    revalidatePath("/intros")
    revalidatePath("/dashboard")
    revalidatePath("/moves")
    return NextResponse.json({ url: introLinkUrl(final.share_token), request: final })
  } catch (error) {
    console.error("Intro request share error:", error)
    return errorResponse("Could not create a link for this introduction")
  }
}

// Turns the link off: the old URL stops working immediately. Sharing again
// issues a new token.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isValidUUID(id)) return badRequestResponse("Invalid introduction ID")
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data: updated, error } = await supabase
      .from("intro_requests")
      .update({ share_token: null })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle()
    if (error) return errorResponse("Could not turn off this link")
    if (!updated) return notFoundResponse("Introduction not found")

    revalidatePath("/intros")
    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error("Intro request unshare error:", error)
    return errorResponse("Could not turn off this link")
  }
}
