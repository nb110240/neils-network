-- Integrations table: stores OAuth tokens for external services (Google Calendar, etc.)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Only service role should access integrations (tokens are sensitive)
-- No user-facing RLS policies. All access goes through service role client.

-- Index for lookup by user + provider
CREATE INDEX IF NOT EXISTS idx_integrations_user_provider ON integrations(user_id, provider);
