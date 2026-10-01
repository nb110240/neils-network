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
    'connector_name', connector.name,
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
-- per referrer. Idempotent: only a 'signed_up' referral can be rewarded.
CREATE OR REPLACE FUNCTION public.grant_referral_reward(p_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ref public.referrals%ROWTYPE;
  rewarded_count integer;
  paid_until timestamptz;
  credit_until timestamptz;
BEGIN
  SELECT * INTO ref FROM public.referrals
  WHERE referred_user_id = p_referred_user_id AND status = 'signed_up'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Serialize rewards per referrer so the cap holds under concurrency.
  PERFORM pg_advisory_xact_lock(hashtextextended(ref.referrer_id::text, 0));

  SELECT count(*) INTO rewarded_count
  FROM public.referrals
  WHERE referrer_id = ref.referrer_id AND status = 'rewarded';

  IF rewarded_count >= 12 THEN
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

COMMIT;
