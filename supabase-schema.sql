-- Neil's Network - Supabase Database Schema
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
  embedding vector(1536),  -- OpenAI text-embedding-ada-002 dimension
  source TEXT DEFAULT 'web',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX contacts_created_by_idx ON contacts(created_by);
CREATE INDEX contacts_follow_up_idx ON contacts(follow_up_needed) WHERE follow_up_needed = true;
CREATE INDEX contacts_created_at_idx ON contacts(created_at DESC);

-- Vector similarity index (IVFFlat) for semantic search
-- Note: Only create this after you have some data, or use HNSW instead for small datasets
-- CREATE INDEX contacts_embedding_idx ON contacts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- For small datasets, use HNSW which doesn't require training data:
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
