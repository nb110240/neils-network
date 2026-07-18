-- Raise Autopilot core: human-reviewed interactions and durable commitments.
-- AI analysis never mutates contacts directly. The approval RPC applies the
-- reviewed proposal atomically and is safe to retry.

BEGIN;

CREATE TABLE public.after_call_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'calendar', 'granola', 'forwarded_email')),
  external_source_id text,
  title text NOT NULL DEFAULT 'Meeting notes'
    CHECK (char_length(title) BETWEEN 1 AND 200),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  raw_text text NOT NULL
    CHECK (char_length(raw_text) BETWEEN 1 AND 100000),
  content_hash text NOT NULL CHECK (char_length(content_hash) = 64),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 4000),
  proposed_contact_patch jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(proposed_contact_patch) = 'object'),
  proposed_commitments jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(proposed_commitments) = 'array'),
  proposed_follow_up text CHECK (char_length(proposed_follow_up) <= 10000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'dismissed')),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX after_call_reviews_external_source_unique_idx
  ON public.after_call_reviews(user_id, source, external_source_id)
  WHERE external_source_id IS NOT NULL;

CREATE INDEX after_call_reviews_user_status_idx
  ON public.after_call_reviews(user_id, status, occurred_at DESC);

CREATE INDEX after_call_reviews_contact_idx
  ON public.after_call_reviews(contact_id, occurred_at DESC);

CREATE INDEX after_call_reviews_content_hash_idx
  ON public.after_call_reviews(user_id, content_hash);

-- A high-entropy inbound address lets a founder forward notes into Savvo.
-- The table intentionally has no user-facing RLS policies: only server routes
-- using the service role may resolve or rotate the address.
CREATE TABLE public.inbound_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  alias_token text NOT NULL UNIQUE
    CHECK (alias_token ~ '^[a-f0-9]{48}$'),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inbound_aliases_enabled_token_idx
  ON public.inbound_aliases(alias_token)
  WHERE enabled = true;

-- Lifetime free allowances cannot be inferred from rows users may delete.
-- This service-only ledger is updated through atomic RPCs below.
CREATE TABLE public.usage_counters (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_reviews_used integer NOT NULL DEFAULT 0 CHECK (ai_reviews_used >= 0),
  csv_contacts_imported integer NOT NULL DEFAULT 0 CHECK (csv_contacts_imported >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.usage_counters (user_id, ai_reviews_used, csv_contacts_imported)
SELECT user_id, sum(ai_reviews_used)::integer, sum(csv_contacts_imported)::integer
FROM (
  SELECT user_id, count(*)::integer AS ai_reviews_used, 0::integer AS csv_contacts_imported
  FROM public.after_call_reviews
  GROUP BY user_id
  UNION ALL
  SELECT created_by AS user_id, 0::integer, count(*)::integer
  FROM public.contacts
  WHERE source = 'csv_import'
  GROUP BY created_by
) existing_usage
GROUP BY user_id
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE public.investor_research_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  identity_fingerprint text NOT NULL CHECK (char_length(identity_fingerprint) = 64),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 20000),
  citations jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(citations) = 'array'),
  model text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 100),
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investor_research_contact_generated_idx
  ON public.investor_research_reports(user_id, contact_id, generated_at DESC);

CREATE TABLE public.intro_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  connector_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'requested', 'accepted', 'introduced', 'meeting_booked', 'closed', 'declined')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  path_evidence text CHECK (char_length(path_evidence) <= 2000),
  path_confidence text NOT NULL DEFAULT 'possible'
    CHECK (path_confidence IN ('verified', 'possible', 'context_only')),
  strength_score smallint NOT NULL DEFAULT 0 CHECK (strength_score BETWEEN 0 AND 100),
  draft_message text NOT NULL CHECK (char_length(draft_message) BETWEEN 1 AND 10000),
  next_follow_up_at timestamptz,
  requested_at timestamptz,
  accepted_at timestamptz,
  introduced_at timestamptz,
  meeting_booked_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (connector_contact_id IS NULL OR connector_contact_id <> target_contact_id)
);

CREATE INDEX intro_requests_user_status_followup_idx
  ON public.intro_requests(user_id, status, next_follow_up_at);

CREATE INDEX intro_requests_target_idx
  ON public.intro_requests(target_contact_id, created_at DESC);

CREATE TABLE public.commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  source_activity_id uuid REFERENCES public.contact_activities(id) ON DELETE SET NULL,
  review_id uuid REFERENCES public.after_call_reviews(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('user_owes', 'contact_owes')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  details text CHECK (char_length(details) <= 4000),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'snoozed', 'cancelled')),
  snoozed_until timestamptz,
  evidence text CHECK (char_length(evidence) <= 2000),
  confidence numeric(4,3) NOT NULL DEFAULT 1
    CHECK (confidence BETWEEN 0 AND 1),
  priority smallint NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'snoozed' OR snoozed_until IS NOT NULL),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE INDEX commitments_user_status_due_idx
  ON public.commitments(user_id, status, due_at);

CREATE INDEX commitments_contact_idx
  ON public.commitments(contact_id, created_at DESC);

CREATE INDEX commitments_review_idx
  ON public.commitments(review_id);

ALTER TABLE public.merge_log
  ADD COLUMN IF NOT EXISTS moved_commitment_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moved_review_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moved_research_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intro_request_changes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error text;

CREATE INDEX IF NOT EXISTS integrations_calendar_attempt_idx
  ON public.integrations(last_attempt_at NULLS FIRST)
  WHERE provider = 'google_calendar';

ALTER TABLE public.after_call_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_research_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intro_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own after-call reviews"
  ON public.after_call_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own after-call reviews"
  ON public.after_call_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      contact_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = contact_id
          AND c.created_by = auth.uid()
          AND c.archived_at IS NULL
      )
    )
  );

CREATE POLICY "Users can update own after-call reviews"
  ON public.after_call_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      contact_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = contact_id
          AND c.created_by = auth.uid()
          AND c.archived_at IS NULL
      )
    )
  );

CREATE POLICY "Users can delete own after-call reviews"
  ON public.after_call_reviews FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own commitments"
  ON public.commitments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own commitments"
  ON public.commitments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id
        AND c.created_by = auth.uid()
        AND c.archived_at IS NULL
    )
  );

CREATE POLICY "Users can update own commitments"
  ON public.commitments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id
        AND c.created_by = auth.uid()
        AND c.archived_at IS NULL
    )
  );

CREATE POLICY "Users can delete own commitments"
  ON public.commitments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own investor research"
  ON public.investor_research_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investor research"
  ON public.investor_research_reports FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id
        AND c.created_by = auth.uid()
        AND c.archived_at IS NULL
    )
  );

CREATE POLICY "Users can update own investor research"
  ON public.investor_research_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id
        AND c.created_by = auth.uid()
        AND c.archived_at IS NULL
    )
  );

CREATE POLICY "Users can delete own investor research"
  ON public.investor_research_reports FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own intro requests"
  ON public.intro_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intro requests"
  ON public.intro_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.contacts target
      WHERE target.id = target_contact_id
        AND target.created_by = auth.uid()
        AND target.archived_at IS NULL
    )
    AND (
      connector_contact_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts connector
        WHERE connector.id = connector_contact_id
          AND connector.created_by = auth.uid()
          AND connector.archived_at IS NULL
      )
    )
  );

CREATE POLICY "Users can update own intro requests"
  ON public.intro_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.contacts target
      WHERE target.id = target_contact_id
        AND target.created_by = auth.uid()
        AND target.archived_at IS NULL
    )
    AND (
      connector_contact_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts connector
        WHERE connector.id = connector_contact_id
          AND connector.created_by = auth.uid()
          AND connector.archived_at IS NULL
      )
    )
  );

CREATE POLICY "Users can delete own intro requests"
  ON public.intro_requests FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER after_call_reviews_updated_at
  BEFORE UPDATE ON public.after_call_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER inbound_aliases_updated_at
  BEFORE UPDATE ON public.inbound_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER investor_research_reports_updated_at
  BEFORE UPDATE ON public.investor_research_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER intro_requests_updated_at
  BEFORE UPDATE ON public.intro_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER commitments_updated_at
  BEFORE UPDATE ON public.commitments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.reserve_free_ai_review(
  target_user_id uuid,
  limit_count integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  used_count integer;
BEGIN
  IF target_user_id IS NULL OR limit_count < 1 THEN
    RAISE EXCEPTION 'Invalid allowance reservation';
  END IF;

  INSERT INTO public.usage_counters (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT ai_reviews_used INTO used_count
  FROM public.usage_counters
  WHERE user_id = target_user_id
  FOR UPDATE;

  IF used_count >= limit_count THEN
    RETURN jsonb_build_object('allowed', false, 'used', used_count, 'remaining', 0);
  END IF;

  UPDATE public.usage_counters
  SET ai_reviews_used = ai_reviews_used + 1, updated_at = now()
  WHERE user_id = target_user_id
  RETURNING ai_reviews_used INTO used_count;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', used_count,
    'remaining', GREATEST(0, limit_count - used_count)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_free_ai_review(target_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.usage_counters
  SET ai_reviews_used = GREATEST(0, ai_reviews_used - 1), updated_at = now()
  WHERE user_id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.reserve_free_csv_contacts(
  target_user_id uuid,
  requested_count integer,
  limit_count integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  used_count integer;
BEGIN
  IF target_user_id IS NULL OR requested_count < 1 OR limit_count < 1 THEN
    RAISE EXCEPTION 'Invalid allowance reservation';
  END IF;

  INSERT INTO public.usage_counters (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT csv_contacts_imported INTO used_count
  FROM public.usage_counters
  WHERE user_id = target_user_id
  FOR UPDATE;

  IF used_count + requested_count > limit_count THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', used_count,
      'remaining', GREATEST(0, limit_count - used_count)
    );
  END IF;

  UPDATE public.usage_counters
  SET csv_contacts_imported = csv_contacts_imported + requested_count, updated_at = now()
  WHERE user_id = target_user_id
  RETURNING csv_contacts_imported INTO used_count;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', used_count,
    'remaining', GREATEST(0, limit_count - used_count)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_free_csv_contacts(
  target_user_id uuid,
  refund_count integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.usage_counters
  SET csv_contacts_imported = GREATEST(0, csv_contacts_imported - GREATEST(0, refund_count)),
      updated_at = now()
  WHERE user_id = target_user_id;
$$;

REVOKE ALL ON FUNCTION public.reserve_free_ai_review(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_free_ai_review(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_free_ai_review(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_free_ai_review(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.refund_free_ai_review(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_free_ai_review(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refund_free_ai_review(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_free_ai_review(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_free_csv_contacts(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_free_csv_contacts(uuid, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_free_csv_contacts(uuid, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_free_csv_contacts(uuid, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.refund_free_csv_contacts(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_free_csv_contacts(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.refund_free_csv_contacts(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_free_csv_contacts(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.approve_after_call_review(p_review_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  review_row public.after_call_reviews%ROWTYPE;
  resolved_contact_id uuid;
  activity_id uuid;
  commitment_item jsonb;
  commitment_count integer := 0;
  has_user_commitment boolean := false;
  patch jsonb;
BEGIN
  SELECT * INTO review_row
  FROM public.after_call_reviews
  WHERE id = p_review_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found';
  END IF;

  IF review_row.status = 'approved' THEN
    RETURN jsonb_build_object(
      'review_id', review_row.id,
      'contact_id', review_row.contact_id,
      'already_approved', true
    );
  END IF;

  IF review_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending reviews can be approved';
  END IF;

  patch := review_row.proposed_contact_patch;

  IF review_row.contact_id IS NULL THEN
    IF NULLIF(btrim(patch->>'name'), '') IS NULL THEN
      RAISE EXCEPTION 'A contact name is required';
    END IF;

    INSERT INTO public.contacts (
      name,
      email,
      company,
      job_title,
      how_we_met,
      next_steps,
      follow_up_needed,
      last_contact_date,
      raw_note,
      source,
      created_by,
      embedding_status
    ) VALUES (
      NULLIF(btrim(patch->>'name'), ''),
      NULLIF(btrim(patch->>'email'), ''),
      NULLIF(btrim(patch->>'company'), ''),
      NULLIF(btrim(patch->>'job_title'), ''),
      NULLIF(btrim(patch->>'how_we_met'), ''),
      NULLIF(btrim(patch->>'next_steps'), ''),
      jsonb_array_length(review_row.proposed_commitments) > 0,
      review_row.occurred_at::date,
      review_row.summary,
      'after_call_review',
      auth.uid(),
      'pending'
    )
    RETURNING id INTO resolved_contact_id;
  ELSE
    SELECT id INTO resolved_contact_id
    FROM public.contacts
    WHERE id = review_row.contact_id
      AND created_by = auth.uid()
      AND archived_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Contact not found';
    END IF;

    UPDATE public.contacts
    SET
      name = CASE WHEN patch ? 'name' THEN COALESCE(NULLIF(btrim(patch->>'name'), ''), name) ELSE name END,
      email = CASE WHEN patch ? 'email' THEN NULLIF(btrim(patch->>'email'), '') ELSE email END,
      company = CASE WHEN patch ? 'company' THEN NULLIF(btrim(patch->>'company'), '') ELSE company END,
      job_title = CASE WHEN patch ? 'job_title' THEN NULLIF(btrim(patch->>'job_title'), '') ELSE job_title END,
      how_we_met = CASE WHEN patch ? 'how_we_met' THEN NULLIF(btrim(patch->>'how_we_met'), '') ELSE how_we_met END,
      next_steps = CASE WHEN patch ? 'next_steps' THEN NULLIF(btrim(patch->>'next_steps'), '') ELSE next_steps END,
      follow_up_needed = follow_up_needed OR jsonb_array_length(review_row.proposed_commitments) > 0,
      last_contact_date = GREATEST(COALESCE(last_contact_date, review_row.occurred_at::date), review_row.occurred_at::date)
    WHERE id = resolved_contact_id
      AND created_by = auth.uid();
  END IF;

  INSERT INTO public.contact_activities (
    contact_id,
    user_id,
    type,
    content,
    occurred_at,
    follow_up_needed,
    source,
    source_event_id
  ) VALUES (
    resolved_contact_id,
    auth.uid(),
    'meeting',
    review_row.summary,
    review_row.occurred_at,
    jsonb_array_length(review_row.proposed_commitments) > 0,
    review_row.source,
    'review:' || review_row.id::text
  )
  ON CONFLICT (contact_id, source, source_event_id)
    WHERE source_event_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO activity_id;

  IF activity_id IS NULL THEN
    SELECT id INTO activity_id
    FROM public.contact_activities
    WHERE contact_id = resolved_contact_id
      AND source = review_row.source
      AND source_event_id = 'review:' || review_row.id::text;
  END IF;

  FOR commitment_item IN
    SELECT value FROM jsonb_array_elements(review_row.proposed_commitments)
  LOOP
    IF NULLIF(btrim(commitment_item->>'title'), '') IS NULL THEN
      CONTINUE;
    END IF;

    IF commitment_item->>'direction' NOT IN ('user_owes', 'contact_owes') THEN
      RAISE EXCEPTION 'Invalid commitment direction';
    END IF;

    INSERT INTO public.commitments (
      user_id,
      contact_id,
      source_activity_id,
      review_id,
      direction,
      title,
      details,
      due_at,
      evidence,
      confidence,
      priority
    ) VALUES (
      auth.uid(),
      resolved_contact_id,
      activity_id,
      review_row.id,
      commitment_item->>'direction',
      btrim(commitment_item->>'title'),
      NULLIF(btrim(commitment_item->>'details'), ''),
      CASE
        WHEN commitment_item->>'due_at' IS NULL OR commitment_item->>'due_at' = '' THEN NULL
        ELSE (commitment_item->>'due_at')::timestamptz
      END,
      NULLIF(btrim(commitment_item->>'evidence'), ''),
      LEAST(1, GREATEST(0, COALESCE((commitment_item->>'confidence')::numeric, 1))),
      LEAST(100, GREATEST(0, COALESCE((commitment_item->>'priority')::integer, 50)))
    );

    commitment_count := commitment_count + 1;
    has_user_commitment := has_user_commitment OR commitment_item->>'direction' = 'user_owes';
  END LOOP;

  UPDATE public.contacts
  SET follow_up_needed = follow_up_needed OR has_user_commitment
  WHERE id = resolved_contact_id
    AND created_by = auth.uid();

  UPDATE public.after_call_reviews
  SET
    contact_id = resolved_contact_id,
    status = 'approved',
    reviewed_at = now(),
    updated_at = now()
  WHERE id = review_row.id
    AND user_id = auth.uid();

  RETURN jsonb_build_object(
    'review_id', review_row.id,
    'contact_id', resolved_contact_id,
    'activity_id', activity_id,
    'commitments_created', commitment_count,
    'already_approved', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_after_call_review(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_after_call_review(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_after_call_review(uuid) TO authenticated;

-- Contact merge and undo are single database transactions. Any uniqueness,
-- ownership, or child-record failure rolls the whole operation back.
CREATE OR REPLACE FUNCTION public.merge_owned_contacts(
  p_keep_id uuid,
  p_remove_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  keep_row public.contacts%ROWTYPE;
  remove_row public.contacts%ROWTYPE;
  moved_activity_ids uuid[] := ARRAY[]::uuid[];
  moved_commitment_ids uuid[] := ARRAY[]::uuid[];
  moved_review_ids uuid[] := ARRAY[]::uuid[];
  moved_research_ids uuid[] := ARRAY[]::uuid[];
  moved_tag_ids uuid[] := ARRAY[]::uuid[];
  intro_changes jsonb := '[]'::jsonb;
  merged_last_contact date;
  merged_cadence integer;
  merged_scheduled date;
  merged_next_due date;
  merged_raw_note text;
  fields_merged text[];
  merge_log_id uuid;
BEGIN
  IF p_keep_id = p_remove_id THEN
    RAISE EXCEPTION 'Cannot merge a contact with itself';
  END IF;

  SELECT * INTO keep_row
  FROM public.contacts
  WHERE id = p_keep_id
    AND created_by = auth.uid()
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'One or both contacts not found'; END IF;

  SELECT * INTO remove_row
  FROM public.contacts
  WHERE id = p_remove_id
    AND created_by = auth.uid()
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'One or both contacts not found'; END IF;

  merged_last_contact := CASE
    WHEN keep_row.last_contact_date IS NULL THEN remove_row.last_contact_date
    WHEN remove_row.last_contact_date IS NULL THEN keep_row.last_contact_date
    ELSE GREATEST(keep_row.last_contact_date, remove_row.last_contact_date)
  END;
  merged_cadence := COALESCE(keep_row.cadence_days, remove_row.cadence_days);
  merged_scheduled := COALESCE(keep_row.scheduled_follow_up, remove_row.scheduled_follow_up);
  merged_raw_note := CASE
    WHEN remove_row.raw_note IS NOT NULL AND remove_row.raw_note IS DISTINCT FROM keep_row.raw_note
      THEN COALESCE(keep_row.raw_note, '') || E'\n\n---\n\nMerged from duplicate:\n' || remove_row.raw_note
    ELSE keep_row.raw_note
  END;
  merged_next_due := CASE
    WHEN merged_scheduled IS NOT NULL AND merged_scheduled >= current_date THEN merged_scheduled
    WHEN merged_cadence IS NOT NULL AND merged_cadence >= 1
      THEN COALESCE(merged_last_contact, keep_row.created_at::date) + merged_cadence
    ELSE NULL
  END;

  fields_merged := array_remove(ARRAY[
    CASE WHEN keep_row.email IS NULL AND remove_row.email IS NOT NULL THEN 'email' END,
    CASE WHEN keep_row.phone IS NULL AND remove_row.phone IS NOT NULL THEN 'phone' END,
    CASE WHEN keep_row.company IS NULL AND remove_row.company IS NOT NULL THEN 'company' END,
    CASE WHEN keep_row.job_title IS NULL AND remove_row.job_title IS NOT NULL THEN 'job_title' END,
    CASE WHEN keep_row.website IS NULL AND remove_row.website IS NOT NULL THEN 'website' END,
    CASE WHEN keep_row.how_we_met IS NULL AND remove_row.how_we_met IS NOT NULL THEN 'how_we_met' END,
    CASE WHEN keep_row.next_steps IS NULL AND remove_row.next_steps IS NOT NULL THEN 'next_steps' END,
    CASE WHEN NOT COALESCE(keep_row.follow_up_needed, false) AND COALESCE(remove_row.follow_up_needed, false) THEN 'follow_up_needed' END,
    CASE WHEN merged_last_contact IS DISTINCT FROM keep_row.last_contact_date THEN 'last_contact_date' END,
    CASE WHEN merged_cadence IS DISTINCT FROM keep_row.cadence_days THEN 'cadence_days' END,
    CASE WHEN merged_scheduled IS DISTINCT FROM keep_row.scheduled_follow_up THEN 'scheduled_follow_up' END,
    CASE WHEN merged_raw_note IS DISTINCT FROM keep_row.raw_note THEN 'raw_note' END,
    CASE WHEN merged_next_due IS DISTINCT FROM keep_row.next_due_date THEN 'next_due_date' END
  ], NULL);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO moved_activity_ids
  FROM public.contact_activities
  WHERE contact_id = p_remove_id AND user_id = auth.uid();
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO moved_commitment_ids
  FROM public.commitments
  WHERE contact_id = p_remove_id AND user_id = auth.uid();
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO moved_review_ids
  FROM public.after_call_reviews
  WHERE contact_id = p_remove_id AND user_id = auth.uid();
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO moved_research_ids
  FROM public.investor_research_reports
  WHERE contact_id = p_remove_id AND user_id = auth.uid();

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'target_contact_id', target_contact_id,
    'connector_contact_id', connector_contact_id,
    'status', status,
    'path_evidence', path_evidence
  )), '[]'::jsonb) INTO intro_changes
  FROM public.intro_requests
  WHERE user_id = auth.uid()
    AND (target_contact_id = p_remove_id OR connector_contact_id = p_remove_id);

  SELECT COALESCE(array_agg(remove_tag.tag_id), ARRAY[]::uuid[]) INTO moved_tag_ids
  FROM public.contact_tags remove_tag
  WHERE remove_tag.contact_id = p_remove_id
    AND NOT EXISTS (
      SELECT 1 FROM public.contact_tags keep_tag
      WHERE keep_tag.contact_id = p_keep_id
        AND keep_tag.tag_id = remove_tag.tag_id
    );

  UPDATE public.contacts
  SET
    email = COALESCE(keep_row.email, remove_row.email),
    phone = COALESCE(keep_row.phone, remove_row.phone),
    company = COALESCE(keep_row.company, remove_row.company),
    job_title = COALESCE(keep_row.job_title, remove_row.job_title),
    website = COALESCE(keep_row.website, remove_row.website),
    how_we_met = COALESCE(keep_row.how_we_met, remove_row.how_we_met),
    next_steps = COALESCE(keep_row.next_steps, remove_row.next_steps),
    follow_up_needed = COALESCE(keep_row.follow_up_needed, false) OR COALESCE(remove_row.follow_up_needed, false),
    last_contact_date = merged_last_contact,
    cadence_days = merged_cadence,
    scheduled_follow_up = merged_scheduled,
    raw_note = merged_raw_note,
    next_due_date = merged_next_due
  WHERE id = p_keep_id AND created_by = auth.uid();

  UPDATE public.contact_activities SET contact_id = p_keep_id
  WHERE id = ANY(moved_activity_ids) AND user_id = auth.uid();
  UPDATE public.commitments SET contact_id = p_keep_id
  WHERE id = ANY(moved_commitment_ids) AND user_id = auth.uid();
  UPDATE public.after_call_reviews SET contact_id = p_keep_id
  WHERE id = ANY(moved_review_ids) AND user_id = auth.uid();
  UPDATE public.investor_research_reports SET contact_id = p_keep_id
  WHERE id = ANY(moved_research_ids) AND user_id = auth.uid();

  UPDATE public.intro_requests request
  SET
    target_contact_id = CASE WHEN request.target_contact_id = p_remove_id THEN p_keep_id ELSE request.target_contact_id END,
    connector_contact_id = CASE
      WHEN (CASE WHEN request.connector_contact_id = p_remove_id THEN p_keep_id ELSE request.connector_contact_id END)
         = (CASE WHEN request.target_contact_id = p_remove_id THEN p_keep_id ELSE request.target_contact_id END)
        THEN NULL
      ELSE CASE WHEN request.connector_contact_id = p_remove_id THEN p_keep_id ELSE request.connector_contact_id END
    END,
    status = CASE
      WHEN (CASE WHEN request.connector_contact_id = p_remove_id THEN p_keep_id ELSE request.connector_contact_id END)
         = (CASE WHEN request.target_contact_id = p_remove_id THEN p_keep_id ELSE request.target_contact_id END)
        THEN 'draft'
      ELSE request.status
    END,
    path_evidence = CASE
      WHEN (CASE WHEN request.connector_contact_id = p_remove_id THEN p_keep_id ELSE request.connector_contact_id END)
         = (CASE WHEN request.target_contact_id = p_remove_id THEN p_keep_id ELSE request.target_contact_id END)
        THEN left(concat_ws(' ', NULLIF(request.path_evidence, ''), 'Connector path needs revalidation after a contact merge.'), 2000)
      ELSE request.path_evidence
    END
  WHERE request.user_id = auth.uid()
    AND (request.target_contact_id = p_remove_id OR request.connector_contact_id = p_remove_id);

  INSERT INTO public.contact_tags (contact_id, tag_id)
  SELECT p_keep_id, unnest(moved_tag_ids)
  ON CONFLICT DO NOTHING;

  UPDATE public.contacts
  SET archived_at = now()
  WHERE id = p_remove_id AND created_by = auth.uid();

  INSERT INTO public.merge_log (
    user_id,
    kept_contact_id,
    removed_contact_id,
    kept_before,
    removed_before,
    moved_activity_ids,
    moved_commitment_ids,
    moved_review_ids,
    moved_research_ids,
    intro_request_changes,
    moved_tag_ids,
    fields_merged
  ) VALUES (
    auth.uid(),
    p_keep_id,
    p_remove_id,
    to_jsonb(keep_row),
    to_jsonb(remove_row),
    moved_activity_ids,
    moved_commitment_ids,
    moved_review_ids,
    moved_research_ids,
    intro_changes,
    moved_tag_ids,
    fields_merged
  ) RETURNING id INTO merge_log_id;

  RETURN jsonb_build_object(
    'keepId', p_keep_id,
    'removeId', p_remove_id,
    'mergeLogId', merge_log_id,
    'fieldsMerged', to_jsonb(fields_merged)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_owned_contact_merge(p_merge_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  log_row public.merge_log%ROWTYPE;
BEGIN
  SELECT * INTO log_row
  FROM public.merge_log
  WHERE id = p_merge_log_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Merge not found'; END IF;
  IF log_row.undone_at IS NOT NULL THEN RAISE EXCEPTION 'Merge already undone'; END IF;

  PERFORM 1 FROM public.contacts
  WHERE id IN (log_row.kept_contact_id, log_row.removed_contact_id)
    AND created_by = auth.uid()
  FOR UPDATE;
  IF (SELECT count(*) FROM public.contacts
      WHERE id IN (log_row.kept_contact_id, log_row.removed_contact_id)
        AND created_by = auth.uid()) <> 2 THEN
    RAISE EXCEPTION 'Merge contacts are no longer available';
  END IF;

  UPDATE public.contacts SET
    email = log_row.kept_before->>'email',
    phone = log_row.kept_before->>'phone',
    company = log_row.kept_before->>'company',
    job_title = log_row.kept_before->>'job_title',
    website = log_row.kept_before->>'website',
    how_we_met = log_row.kept_before->>'how_we_met',
    next_steps = log_row.kept_before->>'next_steps',
    follow_up_needed = COALESCE((log_row.kept_before->>'follow_up_needed')::boolean, false),
    raw_note = COALESCE(log_row.kept_before->>'raw_note', ''),
    last_contact_date = NULLIF(log_row.kept_before->>'last_contact_date', '')::date,
    cadence_days = NULLIF(log_row.kept_before->>'cadence_days', '')::integer,
    scheduled_follow_up = NULLIF(log_row.kept_before->>'scheduled_follow_up', '')::date,
    next_due_date = NULLIF(log_row.kept_before->>'next_due_date', '')::date
  WHERE id = log_row.kept_contact_id AND created_by = auth.uid();

  UPDATE public.contacts SET
    email = log_row.removed_before->>'email',
    phone = log_row.removed_before->>'phone',
    company = log_row.removed_before->>'company',
    job_title = log_row.removed_before->>'job_title',
    website = log_row.removed_before->>'website',
    how_we_met = log_row.removed_before->>'how_we_met',
    next_steps = log_row.removed_before->>'next_steps',
    follow_up_needed = COALESCE((log_row.removed_before->>'follow_up_needed')::boolean, false),
    raw_note = COALESCE(log_row.removed_before->>'raw_note', ''),
    last_contact_date = NULLIF(log_row.removed_before->>'last_contact_date', '')::date,
    cadence_days = NULLIF(log_row.removed_before->>'cadence_days', '')::integer,
    scheduled_follow_up = NULLIF(log_row.removed_before->>'scheduled_follow_up', '')::date,
    next_due_date = NULLIF(log_row.removed_before->>'next_due_date', '')::date,
    archived_at = NULL
  WHERE id = log_row.removed_contact_id AND created_by = auth.uid();

  UPDATE public.contact_activities SET contact_id = log_row.removed_contact_id
  WHERE id = ANY(log_row.moved_activity_ids) AND user_id = auth.uid();
  UPDATE public.commitments SET contact_id = log_row.removed_contact_id
  WHERE id = ANY(log_row.moved_commitment_ids) AND user_id = auth.uid();
  UPDATE public.after_call_reviews SET contact_id = log_row.removed_contact_id
  WHERE id = ANY(log_row.moved_review_ids) AND user_id = auth.uid();
  UPDATE public.investor_research_reports SET contact_id = log_row.removed_contact_id
  WHERE id = ANY(log_row.moved_research_ids) AND user_id = auth.uid();

  UPDATE public.intro_requests request SET
    target_contact_id = restored.target_contact_id,
    connector_contact_id = restored.connector_contact_id,
    status = restored.status,
    path_evidence = restored.path_evidence
  FROM jsonb_to_recordset(log_row.intro_request_changes) AS restored(
    id uuid,
    target_contact_id uuid,
    connector_contact_id uuid,
    status text,
    path_evidence text
  )
  WHERE request.id = restored.id AND request.user_id = auth.uid();

  DELETE FROM public.contact_tags
  WHERE contact_id = log_row.kept_contact_id
    AND tag_id = ANY(log_row.moved_tag_ids);

  UPDATE public.merge_log
  SET undone_at = now()
  WHERE id = log_row.id AND user_id = auth.uid() AND undone_at IS NULL;

  RETURN jsonb_build_object('success', true, 'mergeLogId', log_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_owned_contacts(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_owned_contacts(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_owned_contacts(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.undo_owned_contact_merge(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_owned_contact_merge(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.undo_owned_contact_merge(uuid) TO authenticated;

-- Keep account deletion exhaustive even if foreign-key behavior changes later.
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.commitments WHERE user_id = target_user_id;
  DELETE FROM public.after_call_reviews WHERE user_id = target_user_id;
  DELETE FROM public.inbound_aliases WHERE user_id = target_user_id;
  DELETE FROM public.usage_counters WHERE user_id = target_user_id;
  DELETE FROM public.investor_research_reports WHERE user_id = target_user_id;
  DELETE FROM public.intro_requests WHERE user_id = target_user_id;
  DELETE FROM public.contact_activities WHERE user_id = target_user_id;
  DELETE FROM public.contact_tags
  WHERE contact_id IN (SELECT id FROM public.contacts WHERE created_by = target_user_id)
     OR tag_id IN (SELECT id FROM public.tags WHERE created_by = target_user_id);
  DELETE FROM public.digest_history WHERE user_id = target_user_id;
  DELETE FROM public.not_duplicate_pairs WHERE user_id = target_user_id;
  DELETE FROM public.merge_log WHERE user_id = target_user_id;
  DELETE FROM public.search_usage WHERE user_id = target_user_id;
  DELETE FROM public.integrations WHERE user_id = target_user_id;
  DELETE FROM public.user_preferences WHERE user_id = target_user_id;
  DELETE FROM public.contacts WHERE created_by = target_user_id;
  DELETE FROM public.tags WHERE created_by = target_user_id;
  DELETE FROM public.events WHERE created_by = target_user_id;
  DELETE FROM public.team_members WHERE user_id = target_user_id;
  DELETE FROM public.teams WHERE owner_id = target_user_id;
  DELETE FROM public.subscriptions WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;

COMMIT;
