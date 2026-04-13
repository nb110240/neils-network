-- Contact scheduling: cadence, scheduled follow-ups, and snooze
-- Enables user-controlled relationship maintenance

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS cadence_days INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scheduled_follow_up DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS snoozed_until DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_due_date DATE DEFAULT NULL;

-- Cadence must be at least 1 day
ALTER TABLE contacts ADD CONSTRAINT cadence_days_positive
  CHECK (cadence_days IS NULL OR cadence_days >= 1);

-- Index for efficient "who is due today?" queries (dashboard + digest cron)
CREATE INDEX IF NOT EXISTS contacts_next_due_date_idx
  ON contacts(next_due_date)
  WHERE next_due_date IS NOT NULL AND archived_at IS NULL;

-- Index for snooze expiration
CREATE INDEX IF NOT EXISTS contacts_snoozed_until_idx
  ON contacts(snoozed_until)
  WHERE snoozed_until IS NOT NULL AND archived_at IS NULL;
