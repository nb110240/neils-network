import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { authenticateRequest, authFailed, badRequestResponse, errorResponse } from "@/lib/api-utils"
import { createShareToken, snapshotUrl } from "@/lib/share-token"
import { INVESTOR_STAGE_VALUES } from "@/lib/investor-stage"

const TitleSchema = z.object({
  title: z.string().trim().max(80).nullable().optional(),
}).strict()

// The owner's view: link state plus the same stage counts the public page shows.
export async function GET() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const [{ data: snapshot, error }, { data: stageRows }] = await Promise.all([
      supabase.from("raise_snapshots").select("token, title").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("contacts")
        .select("investor_stage")
        .eq("created_by", user.id)
        .is("archived_at", null)
        .not("investor_stage", "is", null),
    ])
    if (error) return errorResponse("Could not load your raise snapshot")

    const stages: Record<string, number> = {}
    for (const row of stageRows || []) {
      const stage = row.investor_stage as string
      if ((INVESTOR_STAGE_VALUES as readonly string[]).includes(stage)) stages[stage] = (stages[stage] || 0) + 1
    }

    return NextResponse.json({
      snapshot: snapshot ? { url: snapshotUrl(snapshot.token), title: snapshot.title } : null,
      stages,
    })
  } catch (error) {
    console.error("Raise snapshot GET error:", error)
    return errorResponse("Could not load your raise snapshot")
  }
}

// Create the share link (or update its title). Idempotent: an existing link
// keeps its token so already-shared URLs keep working.
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("create")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const parsed = TitleSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return badRequestResponse("Title must be 80 characters or fewer")
    const title = parsed.data.title?.trim() || null

    const { data: existing } = await supabase
      .from("raise_snapshots")
      .select("token")
      .eq("user_id", user.id)
      .maybeSingle()

    const { data: saved, error } = existing
      ? await supabase
          .from("raise_snapshots")
          .update({ title })
          .eq("user_id", user.id)
          .select("token, title")
          .single()
      : await supabase
          .from("raise_snapshots")
          .insert({ user_id: user.id, token: createShareToken(), title })
          .select("token, title")
          .single()

    if (error || !saved) return errorResponse("Could not save your raise snapshot")
    return NextResponse.json({ snapshot: { url: snapshotUrl(saved.token), title: saved.title } })
  } catch (error) {
    console.error("Raise snapshot POST error:", error)
    return errorResponse("Could not save your raise snapshot")
  }
}

// Revoke: the old link stops working immediately. Creating again issues a
// new token.
export async function DELETE() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth
    const { error } = await supabase.from("raise_snapshots").delete().eq("user_id", user.id)
    if (error) return errorResponse("Could not turn off your raise snapshot")
    return NextResponse.json({ snapshot: null })
  } catch (error) {
    console.error("Raise snapshot DELETE error:", error)
    return errorResponse("Could not turn off your raise snapshot")
  }
}
