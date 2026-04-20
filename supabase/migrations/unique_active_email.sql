-- =====================================================
-- UNIQUE EMAIL PER USER (ACTIVE CONTACTS)
-- Prevents concurrent sync/import runs from inserting two contacts with
-- the same email for the same user. The partial predicate leaves
-- archived contacts exempt (so a merged-then-re-added email can still be
-- represented historically) and also ignores contacts with null emails.
--
-- Order of operations if this migration fails with a duplicate-key error:
--   1. Run the duplicate-review flow in the app to merge existing dupes.
--   2. Rerun this migration.
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS contacts_unique_active_email_idx
  ON contacts(created_by, lower(email))
  WHERE archived_at IS NULL AND email IS NOT NULL;
