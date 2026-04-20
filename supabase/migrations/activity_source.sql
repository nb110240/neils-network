-- =====================================================
-- ACTIVITY SOURCE TRACKING
-- Adds a source and source_event_id to contact_activities so external
-- syncs (calendar, email, etc.) can be made idempotent. A partial unique
-- index ensures re-running a sync cannot duplicate the same external
-- event on a contact's timeline.
-- =====================================================

ALTER TABLE contact_activities
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS source_event_id TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contact_activities_source_event_unique_idx
  ON contact_activities(contact_id, source, source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contact_activities_source_event_lookup_idx
  ON contact_activities(user_id, source, source_event_id)
  WHERE source_event_id IS NOT NULL;
