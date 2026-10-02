-- Weekly pipeline email: people (a co-founder, an advisor) who get a
-- founder's investor pipeline every Monday.
--
-- Recipients aren't Savvo users, so each row carries its own unsubscribe
-- token; the unsubscribe link works without signing in. Only the server
-- (service_role) reads or writes these rows: the API checks ownership and
-- the per-user cap, and a token must never be readable by other accounts.
-- Unsubscribing keeps the row (unsubscribed_at) so the founder can't simply
-- add the same person back.

BEGIN;

CREATE TABLE IF NOT EXISTS public.pipeline_digest_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320 AND email = lower(email)),
  unsubscribe_token text NOT NULL UNIQUE CHECK (unsubscribe_token ~ '^[A-Za-z0-9_-]{32,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  unsubscribed_at timestamptz,
  UNIQUE (user_id, email)
);

ALTER TABLE public.pipeline_digest_recipients ENABLE ROW LEVEL SECURITY;
-- No policies: anon and authenticated get nothing; service_role bypasses RLS.
REVOKE ALL ON public.pipeline_digest_recipients FROM anon, authenticated;

COMMIT;
