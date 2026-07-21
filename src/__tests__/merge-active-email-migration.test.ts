import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720120000_fix_merge_active_email_order.sql"
  ),
  "utf8"
)
const coreMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260717120000_raise_autopilot_core.sql"),
  "utf8"
)

describe("active-email-safe merge migration", () => {
  it("archives the removed active contact before copying its email", () => {
    const finalSnapshotIndex = migration.indexOf(
      "SELECT COALESCE(array_agg(remove_tag.tag_id)"
    )
    const archiveIndex = migration.indexOf("SET archived_at = now()")
    const copyEmailIndex = migration.indexOf(
      "email = COALESCE(keep_row.email, remove_row.email)"
    )

    expect(finalSnapshotIndex).toBeGreaterThan(0)
    expect(archiveIndex).toBeGreaterThan(finalSnapshotIndex)
    expect(archiveIndex).toBeGreaterThan(0)
    expect(copyEmailIndex).toBeGreaterThan(archiveIndex)
    expect(migration.match(/SET archived_at = now\(\)/g)).toHaveLength(1)
  })

  it("keeps undo uniqueness-safe by restoring keep before unarchiving remove", () => {
    const undoFunction = coreMigration.slice(
      coreMigration.indexOf(
        "CREATE OR REPLACE FUNCTION public.undo_owned_contact_merge"
      ),
      coreMigration.indexOf(
        "REVOKE ALL ON FUNCTION public.merge_owned_contacts"
      )
    )
    const restoreKeepIndex = undoFunction.indexOf(
      "email = log_row.kept_before->>'email'"
    )
    const restoreRemoveIndex = undoFunction.indexOf(
      "email = log_row.removed_before->>'email'"
    )
    const unarchiveIndex = undoFunction.indexOf("archived_at = NULL")

    expect(restoreKeepIndex).toBeGreaterThan(0)
    expect(restoreRemoveIndex).toBeGreaterThan(restoreKeepIndex)
    expect(unarchiveIndex).toBeGreaterThan(restoreRemoveIndex)
  })

  it("preserves transactional ownership and execution boundaries", () => {
    expect(migration).toContain("BEGIN;")
    expect(migration).toContain("COMMIT;")
    expect(migration).toContain("SECURITY DEFINER")
    expect(migration).toContain("created_by = auth.uid()")
    expect(migration).toContain("FOR UPDATE")
    expect(migration).toContain("INSERT INTO public.merge_log")
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.merge_owned_contacts(uuid, uuid) TO authenticated"
    )
  })
})
