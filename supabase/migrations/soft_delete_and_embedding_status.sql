-- =====================================================
-- SOFT DELETE: archived_at column on contacts
-- When set, the contact is "deleted" but retained for 30 days.
-- RLS policies updated to filter out archived contacts by default.
-- =====================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index for fast queries excluding archived contacts
CREATE INDEX IF NOT EXISTS contacts_active_idx
  ON contacts(created_by, created_at DESC)
  WHERE archived_at IS NULL;

-- Update RLS policies to exclude archived contacts from normal queries.
-- Users can still see archived contacts via the "Recently Deleted" feature
-- which queries with a separate policy.

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

-- Recreate SELECT to exclude archived by default
-- Note: We use a permissive policy for active contacts + a separate
-- policy for viewing archived contacts. The service role bypasses RLS
-- for cleanup operations.
CREATE POLICY "Users can view own active contacts"
  ON contacts FOR SELECT
  USING (auth.uid() = created_by AND archived_at IS NULL);

CREATE POLICY "Users can view own archived contacts"
  ON contacts FOR SELECT
  USING (auth.uid() = created_by AND archived_at IS NOT NULL);

CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE
  USING (auth.uid() = created_by);

-- Update contact limit enforcement to only count non-archived contacts
CREATE OR REPLACE FUNCTION enforce_contact_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contact_count int;
  user_plan text;
BEGIN
  user_plan := get_user_plan(NEW.created_by);

  IF user_plan = 'free' THEN
    SELECT COUNT(*) INTO contact_count
    FROM contacts
    WHERE created_by = NEW.created_by
      AND archived_at IS NULL;

    IF contact_count >= 25 THEN
      RAISE EXCEPTION 'Free plan limit: maximum 25 contacts. Upgrade to Pro for unlimited.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Update semantic search to exclude archived contacts
CREATE OR REPLACE FUNCTION match_contacts(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  company text,
  job_title text,
  website text,
  how_we_met text,
  next_steps text,
  follow_up_needed boolean,
  last_contact_date date,
  raw_note text,
  source text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.email,
    c.phone,
    c.company,
    c.job_title,
    c.website,
    c.how_we_met,
    c.next_steps,
    c.follow_up_needed,
    c.last_contact_date,
    c.raw_note,
    c.source,
    c.created_by,
    c.created_at,
    c.updated_at,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM contacts c
  WHERE c.created_by = user_id
    AND c.embedding IS NOT NULL
    AND c.archived_at IS NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- EMBEDDING STATUS: track whether embedding was generated
-- Replaces silent fire-and-forget with visible status.
-- =====================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS embedding_status TEXT
  DEFAULT 'pending'
  CHECK (embedding_status IN ('pending', 'complete', 'failed'));

-- Set existing contacts with embeddings to 'complete'
UPDATE contacts SET embedding_status = 'complete' WHERE embedding IS NOT NULL;
UPDATE contacts SET embedding_status = 'failed' WHERE embedding IS NULL AND embedding_status = 'pending';

-- =====================================================
-- ATOMIC ACCOUNT DELETION (RPC function)
-- Wraps all deletions in a single transaction.
-- Called from /api/settings/delete-account
-- =====================================================

CREATE OR REPLACE FUNCTION delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete in dependency order within a single transaction
  DELETE FROM contact_activities WHERE user_id = target_user_id;
  DELETE FROM digest_history WHERE user_id = target_user_id;
  DELETE FROM search_usage WHERE user_id = target_user_id;
  DELETE FROM integrations WHERE user_id = target_user_id;
  DELETE FROM contacts WHERE created_by = target_user_id;
  DELETE FROM subscriptions WHERE user_id = target_user_id;
  -- Note: auth.users deletion must be done via supabase.auth.admin.deleteUser()
  -- after this RPC succeeds, since it's in the auth schema.
END;
$$;
