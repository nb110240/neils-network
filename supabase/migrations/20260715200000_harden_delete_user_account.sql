-- Forward migration for account deletion.
-- Applied manually to production and verified on 2026-07-15.
--
-- The original function predated several user-owned tables and retained
-- PostgreSQL's default PUBLIC execute grant. Keep the function service-role
-- only because SECURITY DEFINER bypasses row-level security.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.contact_activities
  WHERE user_id = target_user_id;

  DELETE FROM public.contact_tags
  WHERE contact_id IN (
    SELECT id FROM public.contacts WHERE created_by = target_user_id
  )
  OR tag_id IN (
    SELECT id FROM public.tags WHERE created_by = target_user_id
  );

  DELETE FROM public.digest_history
  WHERE user_id = target_user_id;

  DELETE FROM public.not_duplicate_pairs
  WHERE user_id = target_user_id;

  DELETE FROM public.merge_log
  WHERE user_id = target_user_id;

  DELETE FROM public.search_usage
  WHERE user_id = target_user_id;

  DELETE FROM public.integrations
  WHERE user_id = target_user_id;

  DELETE FROM public.user_preferences
  WHERE user_id = target_user_id;

  DELETE FROM public.contacts
  WHERE created_by = target_user_id;

  DELETE FROM public.tags
  WHERE created_by = target_user_id;

  DELETE FROM public.events
  WHERE created_by = target_user_id;

  DELETE FROM public.team_members
  WHERE user_id = target_user_id;

  DELETE FROM public.teams
  WHERE owner_id = target_user_id;

  DELETE FROM public.subscriptions
  WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;

COMMENT ON FUNCTION public.delete_user_account(uuid) IS
  'Deletes all public-schema data owned by an auth user. Service role only.';

COMMIT;
