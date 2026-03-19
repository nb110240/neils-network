-- Driftless - Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Contacts table
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  website TEXT,
  how_we_met TEXT,
  next_steps TEXT,
  follow_up_needed BOOLEAN DEFAULT false,
  last_contact_date DATE,
  raw_note TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  source TEXT DEFAULT 'web',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX contacts_created_by_idx ON contacts(created_by);
CREATE INDEX contacts_follow_up_idx ON contacts(follow_up_needed) WHERE follow_up_needed = true;
CREATE INDEX contacts_created_at_idx ON contacts(created_at DESC);

-- Vector similarity index (HNSW for small datasets)
CREATE INDEX contacts_embedding_idx ON contacts USING hnsw (embedding vector_cosine_ops);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own contacts
CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own contacts"
  ON contacts FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE
  USING (auth.uid() = created_by);

-- Semantic search function
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
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- SUBSCRIPTIONS TABLE
-- CRITICAL: No user-facing RLS policies. Users cannot
-- read, insert, update, or delete subscription records.
-- Only the service role key (used by webhooks and server
-- functions) can access this table.
-- =====================================================

CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- NO RLS policies for anon/authenticated users.
-- The service role key bypasses RLS by default.
-- This means:
--   - Users CANNOT query subscriptions via the client-side Supabase SDK
--   - Users CANNOT modify their own plan or status
--   - Only server-side code using SUPABASE_SERVICE_ROLE_KEY can read/write

-- =====================================================
-- DIGEST HISTORY TABLE
-- Same approach: no user-facing RLS policies.
-- Only service role can insert/read (via cron job).
-- =====================================================

CREATE TABLE digest_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT now(),
  clicked BOOLEAN DEFAULT false
);

CREATE INDEX digest_history_user_idx ON digest_history(user_id);
CREATE INDEX digest_history_sent_at_idx ON digest_history(sent_at DESC);

ALTER TABLE digest_history ENABLE ROW LEVEL SECURITY;

-- NO RLS policies. Service role only.

-- =====================================================
-- HELPER: Get user plan (callable from RLS policies if needed)
-- SECURITY DEFINER so it runs with elevated privileges
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_plan(uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan text;
BEGIN
  SELECT plan INTO user_plan
  FROM subscriptions
  WHERE user_id = uid
    AND status = 'active'
    AND (current_period_end IS NULL OR current_period_end > now());
  RETURN COALESCE(user_plan, 'free');
END;
$$;

-- =====================================================
-- CONTACT LIMIT ENFORCEMENT (database-level)
-- Prevents race conditions in contact creation
-- =====================================================

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
    WHERE created_by = NEW.created_by;

    IF contact_count >= 25 THEN
      RAISE EXCEPTION 'Free plan limit: maximum 25 contacts. Upgrade to Pro for unlimited.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_contact_limit_trigger
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_contact_limit();
