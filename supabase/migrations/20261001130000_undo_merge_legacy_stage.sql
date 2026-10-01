-- Undo of a merge made before 20261001120000 must not clear a raise stage
-- set afterwards: those merge_log snapshots have no investor_stage key, so
-- keep the contact's current value unless the snapshot recorded one.
-- Identical to the 20261001120000 definition except that assignment.

BEGIN;

CREATE OR REPLACE FUNCTION public.undo_owned_contact_merge(p_merge_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  log_row public.merge_log%ROWTYPE;
BEGIN
  SELECT * INTO log_row
  FROM public.merge_log
  WHERE id = p_merge_log_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Merge not found'; END IF;
  IF log_row.undone_at IS NOT NULL THEN RAISE EXCEPTION 'Merge already undone'; END IF;

  PERFORM 1 FROM public.contacts
  WHERE id IN (log_row.kept_contact_id, log_row.removed_contact_id)
    AND created_by = auth.uid()
  FOR UPDATE;
  IF (SELECT count(*) FROM public.contacts
      WHERE id IN (log_row.kept_contact_id, log_row.removed_contact_id)
        AND created_by = auth.uid()) <> 2 THEN
    RAISE EXCEPTION 'Merge contacts are no longer available';
  END IF;

  UPDATE public.contacts SET
    email = log_row.kept_before->>'email',
    phone = log_row.kept_before->>'phone',
    company = log_row.kept_before->>'company',
    job_title = log_row.kept_before->>'job_title',
    website = log_row.kept_before->>'website',
    how_we_met = log_row.kept_before->>'how_we_met',
    next_steps = log_row.kept_before->>'next_steps',
    investor_stage = CASE
      WHEN log_row.kept_before ? 'investor_stage' THEN log_row.kept_before->>'investor_stage'
      ELSE investor_stage
    END,
    follow_up_needed = COALESCE((log_row.kept_before->>'follow_up_needed')::boolean, false),
    raw_note = COALESCE(log_row.kept_before->>'raw_note', ''),
    last_contact_date = NULLIF(log_row.kept_before->>'last_contact_date', '')::date,
    cadence_days = NULLIF(log_row.kept_before->>'cadence_days', '')::integer,
    scheduled_follow_up = NULLIF(log_row.kept_before->>'scheduled_follow_up', '')::date,
    next_due_date = NULLIF(log_row.kept_before->>'next_due_date', '')::date
  WHERE id = log_row.kept_contact_id AND created_by = auth.uid();

  UPDATE public.contacts SET
    email = log_row.removed_before->>'email',
    phone = log_row.removed_before->>'phone',
    company = log_row.removed_before->>'company',
    job_title = log_row.removed_before->>'job_title',
    website = log_row.removed_before->>'website',
    how_we_met = log_row.removed_before->>'how_we_met',
    next_steps = log_row.removed_before->>'next_steps',
    follow_up_needed = COALESCE((log_row.removed_before->>'follow_up_needed')::boolean, false),
    raw_note = COALESCE(log_row.removed_before->>'raw_note', ''),
    last_contact_date = NULLIF(log_row.removed_before->>'last_contact_date', '')::date,
    cadence_days = NULLIF(log_row.removed_before->>'cadence_days', '')::integer,
    scheduled_follow_up = NULLIF(log_row.removed_before->>'scheduled_follow_up', '')::date,
    next_due_date = NULLIF(log_row.removed_before->>'next_due_date', '')::date,
    archived_at = NULL
  WHERE id = log_row.removed_contact_id AND created_by = auth.uid();

  UPDATE public.contact_activities SET contact_id = log_row.removed_contact_id
  WHERE id = ANY(log_row.moved_activity_ids) AND user_id = auth.uid();
  UPDATE public.commitments SET contact_id = log_row.removed_contact_id
  WHERE id = ANY(log_row.moved_commitment_ids) AND user_id = auth.uid();
  UPDATE public.after_call_reviews SET contact_id = log_row.removed_contact_id
  WHERE id = ANY(log_row.moved_review_ids) AND user_id = auth.uid();
  UPDATE public.investor_research_reports SET contact_id = log_row.removed_contact_id
  WHERE id = ANY(log_row.moved_research_ids) AND user_id = auth.uid();

  UPDATE public.intro_requests request SET
    target_contact_id = restored.target_contact_id,
    connector_contact_id = restored.connector_contact_id,
    status = restored.status,
    path_evidence = restored.path_evidence
  FROM jsonb_to_recordset(log_row.intro_request_changes) AS restored(
    id uuid,
    target_contact_id uuid,
    connector_contact_id uuid,
    status text,
    path_evidence text
  )
  WHERE request.id = restored.id AND request.user_id = auth.uid();

  DELETE FROM public.contact_tags
  WHERE contact_id = log_row.kept_contact_id
    AND tag_id = ANY(log_row.moved_tag_ids);

  UPDATE public.merge_log
  SET undone_at = now()
  WHERE id = log_row.id AND user_id = auth.uid() AND undone_at IS NULL;

  RETURN jsonb_build_object('success', true, 'mergeLogId', log_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.undo_owned_contact_merge(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_owned_contact_merge(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.undo_owned_contact_merge(uuid) TO authenticated;

COMMIT;
