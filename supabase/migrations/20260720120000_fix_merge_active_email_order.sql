-- Keep contact merges compatible with the partial unique active-email index.
--
-- The original RPC copied the removed contact's email onto the kept contact
-- before archiving the removed row. PostgreSQL correctly rejected that brief
-- two-active-row state. Archive first, after every undo snapshot is captured;
-- the function remains one transaction, so any later failure restores the
-- removed row automatically.

BEGIN;

CREATE OR REPLACE FUNCTION public.merge_owned_contacts(
  p_keep_id uuid,
  p_remove_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  keep_row public.contacts%ROWTYPE;
  remove_row public.contacts%ROWTYPE;
  moved_activity_ids uuid[] := ARRAY[]::uuid[];
  moved_commitment_ids uuid[] := ARRAY[]::uuid[];
  moved_review_ids uuid[] := ARRAY[]::uuid[];
  moved_research_ids uuid[] := ARRAY[]::uuid[];
  moved_tag_ids uuid[] := ARRAY[]::uuid[];
  intro_changes jsonb := '[]'::jsonb;
  merged_last_contact date;
  merged_cadence integer;
  merged_scheduled date;
  merged_next_due date;
  merged_raw_note text;
  fields_merged text[];
  merge_log_id uuid;
BEGIN
  IF p_keep_id = p_remove_id THEN
    RAISE EXCEPTION 'Cannot merge a contact with itself';
  END IF;

  SELECT * INTO keep_row
  FROM public.contacts
  WHERE id = p_keep_id
    AND created_by = auth.uid()
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'One or both contacts not found'; END IF;

  SELECT * INTO remove_row
  FROM public.contacts
  WHERE id = p_remove_id
    AND created_by = auth.uid()
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'One or both contacts not found'; END IF;

  merged_last_contact := CASE
    WHEN keep_row.last_contact_date IS NULL THEN remove_row.last_contact_date
    WHEN remove_row.last_contact_date IS NULL THEN keep_row.last_contact_date
    ELSE GREATEST(keep_row.last_contact_date, remove_row.last_contact_date)
  END;
  merged_cadence := COALESCE(keep_row.cadence_days, remove_row.cadence_days);
  merged_scheduled := COALESCE(keep_row.scheduled_follow_up, remove_row.scheduled_follow_up);
  merged_raw_note := CASE
    WHEN remove_row.raw_note IS NOT NULL AND remove_row.raw_note IS DISTINCT FROM keep_row.raw_note
      THEN COALESCE(keep_row.raw_note, '') || E'\n\n---\n\nMerged from duplicate:\n' || remove_row.raw_note
    ELSE keep_row.raw_note
  END;
  merged_next_due := CASE
    WHEN merged_scheduled IS NOT NULL AND merged_scheduled >= current_date THEN merged_scheduled
    WHEN merged_cadence IS NOT NULL AND merged_cadence >= 1
      THEN COALESCE(merged_last_contact, keep_row.created_at::date) + merged_cadence
    ELSE NULL
  END;

  fields_merged := array_remove(ARRAY[
    CASE WHEN keep_row.email IS NULL AND remove_row.email IS NOT NULL THEN 'email' END,
    CASE WHEN keep_row.phone IS NULL AND remove_row.phone IS NOT NULL THEN 'phone' END,
    CASE WHEN keep_row.company IS NULL AND remove_row.company IS NOT NULL THEN 'company' END,
    CASE WHEN keep_row.job_title IS NULL AND remove_row.job_title IS NOT NULL THEN 'job_title' END,
    CASE WHEN keep_row.website IS NULL AND remove_row.website IS NOT NULL THEN 'website' END,
    CASE WHEN keep_row.how_we_met IS NULL AND remove_row.how_we_met IS NOT NULL THEN 'how_we_met' END,
    CASE WHEN keep_row.next_steps IS NULL AND remove_row.next_steps IS NOT NULL THEN 'next_steps' END,
    CASE WHEN NOT COALESCE(keep_row.follow_up_needed, false) AND COALESCE(remove_row.follow_up_needed, false) THEN 'follow_up_needed' END,
    CASE WHEN merged_last_contact IS DISTINCT FROM keep_row.last_contact_date THEN 'last_contact_date' END,
    CASE WHEN merged_cadence IS DISTINCT FROM keep_row.cadence_days THEN 'cadence_days' END,
    CASE WHEN merged_scheduled IS DISTINCT FROM keep_row.scheduled_follow_up THEN 'scheduled_follow_up' END,
    CASE WHEN merged_raw_note IS DISTINCT FROM keep_row.raw_note THEN 'raw_note' END,
    CASE WHEN merged_next_due IS DISTINCT FROM keep_row.next_due_date THEN 'next_due_date' END
  ], NULL);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO moved_activity_ids
  FROM public.contact_activities
  WHERE contact_id = p_remove_id AND user_id = auth.uid();
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO moved_commitment_ids
  FROM public.commitments
  WHERE contact_id = p_remove_id AND user_id = auth.uid();
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO moved_review_ids
  FROM public.after_call_reviews
  WHERE contact_id = p_remove_id AND user_id = auth.uid();
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO moved_research_ids
  FROM public.investor_research_reports
  WHERE contact_id = p_remove_id AND user_id = auth.uid();

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'target_contact_id', target_contact_id,
    'connector_contact_id', connector_contact_id,
    'status', status,
    'path_evidence', path_evidence
  )), '[]'::jsonb) INTO intro_changes
  FROM public.intro_requests
  WHERE user_id = auth.uid()
    AND (target_contact_id = p_remove_id OR connector_contact_id = p_remove_id);

  SELECT COALESCE(array_agg(remove_tag.tag_id), ARRAY[]::uuid[]) INTO moved_tag_ids
  FROM public.contact_tags remove_tag
  WHERE remove_tag.contact_id = p_remove_id
    AND NOT EXISTS (
      SELECT 1 FROM public.contact_tags keep_tag
      WHERE keep_tag.contact_id = p_keep_id
        AND keep_tag.tag_id = remove_tag.tag_id
    );

  -- Release the removed contact's partial unique-index entries before copying
  -- missing fields to the kept contact. keep_row/remove_row already hold the
  -- complete undo snapshots, and a later exception rolls this update back.
  UPDATE public.contacts
  SET archived_at = now()
  WHERE id = p_remove_id
    AND created_by = auth.uid()
    AND archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact to remove is no longer active';
  END IF;

  UPDATE public.contacts
  SET
    email = COALESCE(keep_row.email, remove_row.email),
    phone = COALESCE(keep_row.phone, remove_row.phone),
    company = COALESCE(keep_row.company, remove_row.company),
    job_title = COALESCE(keep_row.job_title, remove_row.job_title),
    website = COALESCE(keep_row.website, remove_row.website),
    how_we_met = COALESCE(keep_row.how_we_met, remove_row.how_we_met),
    next_steps = COALESCE(keep_row.next_steps, remove_row.next_steps),
    follow_up_needed = COALESCE(keep_row.follow_up_needed, false) OR COALESCE(remove_row.follow_up_needed, false),
    last_contact_date = merged_last_contact,
    cadence_days = merged_cadence,
    scheduled_follow_up = merged_scheduled,
    raw_note = merged_raw_note,
    next_due_date = merged_next_due
  WHERE id = p_keep_id AND created_by = auth.uid();

  UPDATE public.contact_activities SET contact_id = p_keep_id
  WHERE id = ANY(moved_activity_ids) AND user_id = auth.uid();
  UPDATE public.commitments SET contact_id = p_keep_id
  WHERE id = ANY(moved_commitment_ids) AND user_id = auth.uid();
  UPDATE public.after_call_reviews SET contact_id = p_keep_id
  WHERE id = ANY(moved_review_ids) AND user_id = auth.uid();
  UPDATE public.investor_research_reports SET contact_id = p_keep_id
  WHERE id = ANY(moved_research_ids) AND user_id = auth.uid();

  UPDATE public.intro_requests request
  SET
    target_contact_id = CASE WHEN request.target_contact_id = p_remove_id THEN p_keep_id ELSE request.target_contact_id END,
    connector_contact_id = CASE
      WHEN (CASE WHEN request.connector_contact_id = p_remove_id THEN p_keep_id ELSE request.connector_contact_id END)
         = (CASE WHEN request.target_contact_id = p_remove_id THEN p_keep_id ELSE request.target_contact_id END)
        THEN NULL
      ELSE CASE WHEN request.connector_contact_id = p_remove_id THEN p_keep_id ELSE request.connector_contact_id END
    END,
    status = CASE
      WHEN (CASE WHEN request.connector_contact_id = p_remove_id THEN p_keep_id ELSE request.connector_contact_id END)
         = (CASE WHEN request.target_contact_id = p_remove_id THEN p_keep_id ELSE request.target_contact_id END)
        THEN 'draft'
      ELSE request.status
    END,
    path_evidence = CASE
      WHEN (CASE WHEN request.connector_contact_id = p_remove_id THEN p_keep_id ELSE request.connector_contact_id END)
         = (CASE WHEN request.target_contact_id = p_remove_id THEN p_keep_id ELSE request.target_contact_id END)
        THEN left(concat_ws(' ', NULLIF(request.path_evidence, ''), 'Connector path needs revalidation after a contact merge.'), 2000)
      ELSE request.path_evidence
    END
  WHERE request.user_id = auth.uid()
    AND (request.target_contact_id = p_remove_id OR request.connector_contact_id = p_remove_id);

  INSERT INTO public.contact_tags (contact_id, tag_id)
  SELECT p_keep_id, unnest(moved_tag_ids)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.merge_log (
    user_id,
    kept_contact_id,
    removed_contact_id,
    kept_before,
    removed_before,
    moved_activity_ids,
    moved_commitment_ids,
    moved_review_ids,
    moved_research_ids,
    intro_request_changes,
    moved_tag_ids,
    fields_merged
  ) VALUES (
    auth.uid(),
    p_keep_id,
    p_remove_id,
    to_jsonb(keep_row),
    to_jsonb(remove_row),
    moved_activity_ids,
    moved_commitment_ids,
    moved_review_ids,
    moved_research_ids,
    intro_changes,
    moved_tag_ids,
    fields_merged
  ) RETURNING id INTO merge_log_id;

  RETURN jsonb_build_object(
    'keepId', p_keep_id,
    'removeId', p_remove_id,
    'mergeLogId', merge_log_id,
    'fieldsMerged', to_jsonb(fields_merged)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_owned_contacts(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_owned_contacts(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_owned_contacts(uuid, uuid) TO authenticated;

COMMIT;
