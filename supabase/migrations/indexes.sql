-- Performance indexes for frequently queried columns

-- Health score calculations sort by last_contact_date
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact ON contacts(created_by, last_contact_date);

-- Dashboard queries filter by follow_up_needed
CREATE INDEX IF NOT EXISTS idx_contacts_follow_up ON contacts(created_by, follow_up_needed) WHERE follow_up_needed = true;

-- Digest and dashboard sort by created_at
CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_by, created_at DESC);
