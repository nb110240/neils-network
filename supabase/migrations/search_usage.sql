-- Search usage tracking: enforces free plan semantic search limits
CREATE TABLE IF NOT EXISTS search_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  searched_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE search_usage ENABLE ROW LEVEL SECURITY;

-- No user-facing RLS policies. Service role only for tracking.

-- Index for monthly usage queries
CREATE INDEX IF NOT EXISTS idx_search_usage_user_month ON search_usage(user_id, searched_at);
