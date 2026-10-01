// ─── Shared contact column list for reads ───
// The full Contact shape MINUS the 1536-dim `embedding` vector (~6-20KB/row),
// which the UI never reads — `select("*")` was shipping it on every row
// (a 200-contact network downloaded 1-4MB of floats the client discarded).
// Use this for any contact SELECT whose rows reach the browser.
export const CONTACT_COLUMNS =
  "id, name, email, phone, company, job_title, website, how_we_met, next_steps, follow_up_needed, last_contact_date, raw_note, embedding_status, source, created_by, event_id, cadence_days, scheduled_follow_up, snoozed_until, next_due_date, investor_stage, created_at, updated_at, archived_at"
