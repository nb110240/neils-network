-- =====================================================
-- CONTACT ACTIVITIES TABLE
-- Replaces the fragile raw_note meeting storage pattern.
-- Each interaction with a contact is a separate record.
-- =====================================================

CREATE TABLE IF NOT EXISTS contact_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'meeting' CHECK (type IN ('meeting', 'note', 'call', 'email', 'other')),
  content TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  follow_up_needed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX contact_activities_contact_idx ON contact_activities(contact_id, occurred_at DESC);
CREATE INDEX contact_activities_user_idx ON contact_activities(user_id);

-- RLS: users can only access activities for their own contacts
ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contact activities"
  ON contact_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contact activities"
  ON contact_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contact activities"
  ON contact_activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contact activities"
  ON contact_activities FOR DELETE
  USING (auth.uid() = user_id);
