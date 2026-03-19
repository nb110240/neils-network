-- User preferences table for notification settings
-- Service role only — no user-facing RLS policies

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_frequency text NOT NULL DEFAULT 'daily' CHECK (digest_frequency IN ('daily', 'weekly', 'never')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- NO user-facing policies. Service role bypasses RLS.
-- This prevents users from reading or modifying other users' preferences.

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
