-- Push notifications and Sign in with Apple support.
--
-- push_tokens: one row per device. iOS rows hold APNs device tokens, Android
-- rows hold FCM registration tokens. Only the server (service_role) reads or
-- writes them: a device token can be moved to a different account when
-- someone else signs in on the same phone, which a per-user RLS policy could
-- not express, and clients never need to read tokens back.
--
-- apple_sign_in_tokens: the Apple refresh token for accounts created with
-- Sign in with Apple, kept only so account deletion can revoke it as App
-- Review guideline 5.1.1(v) requires. Service role only.
--
-- user_preferences.push_enabled: per-account switch for push notifications.

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (char_length(token) BETWEEN 16 AND 4096),
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: anon and authenticated get nothing; service_role bypasses RLS.
REVOKE ALL ON public.push_tokens FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.apple_sign_in_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  refresh_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apple_sign_in_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apple_sign_in_tokens FROM anon, authenticated;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true;

COMMIT;
