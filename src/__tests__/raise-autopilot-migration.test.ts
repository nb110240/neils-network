import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260717120000_raise_autopilot_core.sql"),
  "utf8"
)

describe("Raise Autopilot migration", () => {
  it("protects every new user-owned table with owner RLS", () => {
    expect(migration).toContain("ALTER TABLE public.after_call_reviews ENABLE ROW LEVEL SECURITY")
    expect(migration).toContain("ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY")
    expect(migration).toContain("ALTER TABLE public.investor_research_reports ENABLE ROW LEVEL SECURITY")
    expect(migration).toContain("ALTER TABLE public.intro_requests ENABLE ROW LEVEL SECURITY")
    expect(migration).toContain("ALTER TABLE public.inbound_aliases ENABLE ROW LEVEL SECURITY")
    expect(migration).toContain("ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY")
    expect(migration.match(/auth\.uid\(\) = user_id/g)?.length).toBeGreaterThanOrEqual(6)
  })

  it("locks and atomically transitions only the authenticated user's pending review", () => {
    const approvalFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.approve_after_call_review"),
      migration.indexOf("REVOKE ALL ON FUNCTION public.approve_after_call_review")
    )
    expect(approvalFunction).toContain("user_id = auth.uid()")
    expect(approvalFunction).toContain("FOR UPDATE")
    expect(approvalFunction).toContain("review_row.status <> 'pending'")
    expect(approvalFunction).toContain("status = 'approved'")
    expect(approvalFunction).not.toContain("SECURITY DEFINER")
  })

  it("makes activity creation idempotent and extends account deletion", () => {
    expect(migration).toContain("'review:' || review_row.id::text")
    expect(migration).toContain("ON CONFLICT (contact_id, source, source_event_id)")
    expect(migration).toContain("DELETE FROM public.commitments WHERE user_id = target_user_id")
    expect(migration).toContain("DELETE FROM public.after_call_reviews WHERE user_id = target_user_id")
    expect(migration).toContain("DELETE FROM public.investor_research_reports WHERE user_id = target_user_id")
    expect(migration).toContain("DELETE FROM public.intro_requests WHERE user_id = target_user_id")
    expect(migration).toContain("DELETE FROM public.inbound_aliases WHERE user_id = target_user_id")
    expect(migration).toContain("DELETE FROM public.usage_counters WHERE user_id = target_user_id")
  })

  it("keeps integration tokens service-only and introduction contact references owner-checked", () => {
    expect(migration).toContain("The table intentionally has no user-facing RLS policies")
    expect(migration).toContain("target.created_by = auth.uid()")
    expect(migration).toContain("connector.created_by = auth.uid()")
    expect(migration).toContain("intro_request_changes jsonb")
    expect(migration).toContain("last_attempt_at timestamptz")
    expect(migration).toContain("integrations_calendar_attempt_idx")
  })

  it("uses service-only atomic lifetime allowance counters", () => {
    expect(migration).toContain("CREATE TABLE public.usage_counters")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.reserve_free_ai_review")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.reserve_free_csv_contacts")
    expect(migration).toContain("FOR UPDATE")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.reserve_free_ai_review(uuid, integer) TO service_role")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.reserve_free_csv_contacts(uuid, integer, integer) TO service_role")
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.reserve_free_ai_review(uuid, integer) FROM authenticated")
  })

  it("makes contact merge and undo owner-checked transactional RPCs", () => {
    const mergeFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.merge_owned_contacts"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.undo_owned_contact_merge")
    )
    const undoFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.undo_owned_contact_merge"),
      migration.indexOf("REVOKE ALL ON FUNCTION public.merge_owned_contacts")
    )
    expect(mergeFunction).toContain("created_by = auth.uid()")
    expect(mergeFunction).toContain("FOR UPDATE")
    expect(mergeFunction).toContain("INSERT INTO public.merge_log")
    expect(undoFunction).toContain("user_id = auth.uid()")
    expect(undoFunction).toContain("FOR UPDATE")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.merge_owned_contacts(uuid, uuid) TO authenticated")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.undo_owned_contact_merge(uuid) TO authenticated")
  })
})
