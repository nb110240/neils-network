-- =====================================================
-- DUPLICATE MANAGEMENT
-- Persistent "not a duplicate" decisions + undoable merges.
-- =====================================================

-- not_duplicate_pairs: user-confirmed non-duplicates.
-- Canonical key uses LEAST/GREATEST so (a,b) and (b,a) dedupe.
CREATE TABLE IF NOT EXISTS not_duplicate_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_a_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_b_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (contact_a_id < contact_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS not_duplicate_pairs_unique_idx
  ON not_duplicate_pairs(user_id, contact_a_id, contact_b_id);

CREATE INDEX IF NOT EXISTS not_duplicate_pairs_user_idx
  ON not_duplicate_pairs(user_id);

ALTER TABLE not_duplicate_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dismissed pairs"
  ON not_duplicate_pairs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- merge_log: snapshot of a merge operation for undo support.
-- Stores the full pre-merge state of both contacts plus activity/tag
-- moves so we can reverse within the undo window.
CREATE TABLE IF NOT EXISTS merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kept_contact_id UUID NOT NULL,
  removed_contact_id UUID NOT NULL,
  kept_before JSONB NOT NULL,
  removed_before JSONB NOT NULL,
  moved_activity_ids UUID[] NOT NULL DEFAULT '{}',
  moved_tag_ids UUID[] NOT NULL DEFAULT '{}',
  fields_merged TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  undone_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS merge_log_user_created_idx
  ON merge_log(user_id, created_at DESC)
  WHERE undone_at IS NULL;

ALTER TABLE merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own merge log"
  ON merge_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own merge log"
  ON merge_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own merge log"
  ON merge_log
  FOR UPDATE
  USING (auth.uid() = user_id);
