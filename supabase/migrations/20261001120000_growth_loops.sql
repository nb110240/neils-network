-- Growth loops: referral credits, investor pipeline stage + shareable raise
-- snapshot, and hosted intro-request links for connectors.
--
-- Public surfaces (raise snapshot, intro link) never read tables directly:
-- they go through SECURITY DEFINER functions granted to service_role only,
-- which return the minimum fields needed and look rows up by an unguessable
-- token. Apply this migration BEFORE deploying the code that uses it.

BEGIN;

-- ─── 1. Investor pipeline stage ───────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN investor_stage text
  CHECK (investor_stage IN (
    'researching', 'intro_requested', 'intro_made', 'first_meeting',
    'partner_meeting', 'diligence', 'committed', 'passed'
  ));

CREATE INDEX contacts_owner_investor_stage_idx
  ON public.contacts(created_by, investor_stage)
  WHERE investor_stage IS NOT NULL AND archived_at IS NULL;

-- ─── 2. Raise snapshot ────────────────────────────────────────────────────

CREATE TABLE public.raise_snapshots (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  title text CHECK (char_length(title) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.raise_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own raise snapshot"
  ON public.raise_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own raise snapshot"
  ON public.raise_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own raise snapshot"
  ON public.raise_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own raise snapshot"
  ON public.raise_snapshots FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER raise_snapshots_updated_at
  BEFORE UPDATE ON public.raise_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Aggregate counts only. Never returns contact names, firms or notes.
CREATE OR REPLACE FUNCTION public.raise_snapshot_summary(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  snapshot_row public.raise_snapshots%ROWTYPE;
  stage_counts jsonb;
  last_change timestamptz;
BEGIN
  SELECT * INTO snapshot_row FROM public.raise_snapshots WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    COALESCE(jsonb_object_agg(stage_rows.investor_stage, stage_rows.n), '{}'::jsonb),
    MAX(stage_rows.last_updated)
  INTO stage_counts, last_change
  FROM (
    SELECT c.investor_stage, count(*) AS n, MAX(c.updated_at) AS last_updated
    FROM public.contacts c
    WHERE c.created_by = snapshot_row.user_id
      AND c.archived_at IS NULL
      AND c.investor_stage IS NOT NULL
    GROUP BY c.investor_stage
  ) stage_rows;

  RETURN jsonb_build_object(
    'title', snapshot_row.title,
    'stages', stage_counts,
    'updated_at', COALESCE(last_change, snapshot_row.updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.raise_snapshot_summary(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.raise_snapshot_summary(text) FROM anon;
REVOKE ALL ON FUNCTION public.raise_snapshot_summary(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.raise_snapshot_summary(text) TO service_role;

-- ─── 3. Hosted intro-request links ────────────────────────────────────────

ALTER TABLE public.intro_requests
  ADD COLUMN share_token text UNIQUE CHECK (share_token ~ '^[A-Za-z0-9_-]{32,64}$'),
  ADD COLUMN connector_note text CHECK (char_length(connector_note) <= 1000),
  ADD COLUMN connector_responded_at timestamptz;

-- What a connector sees: who is asking, who they want to meet, why, and the
-- forwardable blurb. The requester's email is deliberately not returned.
CREATE OR REPLACE FUNCTION public.intro_request_for_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'requester_name', NULLIF(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    'connector_name', CASE WHEN connector.archived_at IS NULL THEN connector.name END,
    'target_name', target.name,
    'target_company', target.company,
    'target_job_title', target.job_title,
    'reason', ir.reason,
    'draft_message', ir.draft_message,
    'status', ir.status,
    'responded_at', ir.connector_responded_at
  )
  INTO result
  FROM public.intro_requests ir
  JOIN auth.users u ON u.id = ir.user_id
  JOIN public.contacts target ON target.id = ir.target_contact_id
  LEFT JOIN public.contacts connector ON connector.id = ir.connector_contact_id
  WHERE ir.share_token = p_token
    AND target.archived_at IS NULL;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.intro_request_for_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.intro_request_for_token(text) FROM anon;
REVOKE ALL ON FUNCTION public.intro_request_for_token(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.intro_request_for_token(text) TO service_role;

-- One response per link. Locks the row so a double-click or two tabs cannot
-- both transition it.
CREATE OR REPLACE FUNCTION public.respond_to_intro_request(
  p_token text,
  p_accept boolean,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ir public.intro_requests%ROWTYPE;
  clean_note text := NULLIF(left(trim(COALESCE(p_note, '')), 1000), '');
BEGIN
  SELECT * INTO ir FROM public.intro_requests WHERE share_token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF ir.connector_responded_at IS NOT NULL OR ir.status NOT IN ('draft', 'requested') THEN
    RETURN jsonb_build_object('outcome', 'already_responded', 'status', ir.status);
  END IF;

  IF p_accept THEN
    UPDATE public.intro_requests
    SET status = 'accepted',
        accepted_at = now(),
        next_follow_up_at = now() + interval '3 days',
        connector_note = clean_note,
        connector_responded_at = now(),
        updated_at = now()
    WHERE id = ir.id;
  ELSE
    UPDATE public.intro_requests
    SET status = 'declined',
        closed_at = now(),
        next_follow_up_at = NULL,
        connector_note = clean_note,
        connector_responded_at = now(),
        updated_at = now()
    WHERE id = ir.id;
  END IF;

  RETURN jsonb_build_object(
    'outcome', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
    'user_id', ir.user_id,
    'request_id', ir.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_intro_request(text, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_intro_request(text, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.respond_to_intro_request(text, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_intro_request(text, boolean, text) TO service_role;

-- ─── 4. Referrals and Pro credit ──────────────────────────────────────────

CREATE TABLE public.referral_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]{8}$'),
  -- Durable count for the 12-reward cap. Counting live referrals rows is not
  -- enough: they disappear when a referred account is deleted, which would
  -- let a sign-up/delete loop earn unlimited credit.
  rewards_granted integer NOT NULL DEFAULT 0 CHECK (rewards_granted >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'signed_up'
    CHECK (status IN ('signed_up', 'rewarded', 'capped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  CHECK (referrer_id <> referred_user_id)
);

CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_id, created_at DESC);

-- Pro time earned outside Stripe/RevenueCat. Kept separate from
-- subscriptions so billing webhooks never overwrite earned credit.
CREATE TABLE public.pro_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pro_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_credits ENABLE ROW LEVEL SECURITY;

-- Read-only for owners; all writes go through service_role / functions.
CREATE POLICY "Users can view own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Referrers can view their referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view own pro credit"
  ON public.pro_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Grants the referrer 30 days of Pro once the referred user has a contact.
-- Credit stacks after any active paid period, and is capped at 12 rewards
-- per referrer for the life of the account (referral_codes.rewards_granted).
-- Idempotent: only a 'signed_up' referral can be rewarded.
CREATE OR REPLACE FUNCTION public.grant_referral_reward(p_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ref public.referrals%ROWTYPE;
  paid_until timestamptz;
  credit_until timestamptz;
BEGIN
  SELECT * INTO ref FROM public.referrals
  WHERE referred_user_id = p_referred_user_id AND status = 'signed_up'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Atomic check-and-increment; the row lock serializes concurrent rewards
  -- for the same referrer so the cap holds.
  UPDATE public.referral_codes
  SET rewards_granted = rewards_granted + 1
  WHERE user_id = ref.referrer_id AND rewards_granted < 12;

  IF NOT FOUND THEN
    UPDATE public.referrals SET status = 'capped' WHERE id = ref.id;
    RETURN false;
  END IF;

  SELECT current_period_end INTO paid_until
  FROM public.subscriptions
  WHERE user_id = ref.referrer_id
    AND status = 'active'
    AND plan <> 'free'
    AND current_period_end > now();

  SELECT pro_until INTO credit_until
  FROM public.pro_credits
  WHERE user_id = ref.referrer_id
  FOR UPDATE;

  INSERT INTO public.pro_credits (user_id, pro_until)
  VALUES (
    ref.referrer_id,
    GREATEST(now(), COALESCE(paid_until, now()), COALESCE(credit_until, now())) + interval '30 days'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET pro_until = EXCLUDED.pro_until, updated_at = now();

  UPDATE public.referrals
  SET status = 'rewarded', rewarded_at = now()
  WHERE id = ref.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_referral_reward(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_referral_reward(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.grant_referral_reward(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grant_referral_reward(uuid) TO service_role;

-- Records who referred a new account. Only accounts created in the last
-- 7 days can be claimed, so an existing user cannot be retro-attributed.
-- If the new user already has a contact, the reward is granted at once.
-- Known race: a contact inserted concurrently with the claim is invisible to
-- both checks, so that reward waits for the user's next contact insert.
CREATE OR REPLACE FUNCTION public.claim_referral(p_code text, p_referred_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referrer uuid;
  v_created timestamptz;
  inserted_id uuid;
BEGIN
  SELECT user_id INTO v_referrer FROM public.referral_codes WHERE code = lower(p_code);
  IF v_referrer IS NULL THEN
    RETURN 'invalid_code';
  END IF;
  IF v_referrer = p_referred_user_id THEN
    RETURN 'self_referral';
  END IF;

  SELECT created_at INTO v_created FROM auth.users WHERE id = p_referred_user_id;
  IF v_created IS NULL OR v_created < now() - interval '7 days' THEN
    RETURN 'not_new';
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_user_id)
  VALUES (v_referrer, p_referred_user_id)
  ON CONFLICT (referred_user_id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    RETURN 'already_claimed';
  END IF;

  IF EXISTS (SELECT 1 FROM public.contacts WHERE created_by = p_referred_user_id) THEN
    PERFORM public.grant_referral_reward(p_referred_user_id);
  END IF;

  RETURN 'claimed';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_referral(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.claim_referral(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral(text, uuid) TO service_role;

-- Activation trigger: covers every contact-creation path (add, import,
-- LinkedIn, calendar, review approval) without touching each route. The
-- referrals lookup is a unique-index probe, so bulk imports stay cheap.
CREATE OR REPLACE FUNCTION public.reward_referral_on_first_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.referrals
    WHERE referred_user_id = NEW.created_by AND status = 'signed_up'
  ) THEN
    PERFORM public.grant_referral_reward(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reward_referral_on_first_contact() FROM PUBLIC;

CREATE TRIGGER contacts_reward_referral
  AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.reward_referral_on_first_contact();

-- The free-plan contact limit trigger (enforce_contact_limit) asks
-- get_user_plan(). It must count referral credit as Pro, or credit users are
-- told "unlimited" while inserts past 50 fail. Same signature and privileges
-- as before (CREATE OR REPLACE keeps existing grants).
CREATE OR REPLACE FUNCTION public.get_user_plan(uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_plan text;
BEGIN
  SELECT plan INTO user_plan
  FROM public.subscriptions
  WHERE user_id = uid
    AND status = 'active'
    AND (current_period_end IS NULL OR current_period_end > now());

  IF COALESCE(user_plan, 'free') = 'free' AND EXISTS (
    SELECT 1 FROM public.pro_credits WHERE user_id = uid AND pro_until > now()
  ) THEN
    RETURN 'pro';
  END IF;

  RETURN COALESCE(user_plan, 'free');
END;
$$;

-- ─── 5. Account deletion stays exhaustive ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.raise_snapshots WHERE user_id = target_user_id;
  DELETE FROM public.referrals
  WHERE referrer_id = target_user_id OR referred_user_id = target_user_id;
  DELETE FROM public.referral_codes WHERE user_id = target_user_id;
  DELETE FROM public.pro_credits WHERE user_id = target_user_id;
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

-- ─── 6. Merges keep the raise stage ───────────────────────────────────────
-- Unchanged from 20260720120000 / 20260717120000 except investor_stage:
-- merge fills it from the removed duplicate, undo restores the kept row's
-- original (kept_before is to_jsonb(keep_row), so it already carries it).

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
    CASE WHEN keep_row.investor_stage IS NULL AND remove_row.investor_stage IS NOT NULL THEN 'investor_stage' END,
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

  -- Release the removed contact's partial unique-index entries before copying
  -- missing fields to the kept contact. keep_row/remove_row already hold the
  -- complete undo snapshots, and a later exception rolls this update back.
  UPDATE public.contacts
  SET archived_at = now()
  WHERE id = p_remove_id
    AND created_by = auth.uid()
    AND archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact to remove is no longer active';
  END IF;

  UPDATE public.contacts
  SET
    email = COALESCE(keep_row.email, remove_row.email),
    phone = COALESCE(keep_row.phone, remove_row.phone),
    company = COALESCE(keep_row.company, remove_row.company),
    job_title = COALESCE(keep_row.job_title, remove_row.job_title),
    website = COALESCE(keep_row.website, remove_row.website),
    how_we_met = COALESCE(keep_row.how_we_met, remove_row.how_we_met),
    next_steps = COALESCE(keep_row.next_steps, remove_row.next_steps),
    investor_stage = COALESCE(keep_row.investor_stage, remove_row.investor_stage),
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

REVOKE ALL ON FUNCTION public.merge_owned_contacts(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_owned_contacts(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_owned_contacts(uuid, uuid) TO authenticated;

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
    investor_stage = log_row.kept_before->>'investor_stage',
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

REVOKE ALL ON FUNCTION public.undo_owned_contact_merge(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_owned_contact_merge(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.undo_owned_contact_merge(uuid) TO authenticated;

COMMIT;
