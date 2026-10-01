CREATE OR REPLACE FUNCTION public.admin_user_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'users_total', (SELECT count(*) FROM profiles),
    'users_onboarded', (SELECT count(*) FROM profiles WHERE onboarded),
    'users_new_7', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '7 days'),
    'users_new_30', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '30 days'),
    'active_7', (SELECT count(DISTINCT user_id) FROM journal_entries WHERE created_at > now() - interval '7 days'),
    'active_30', (SELECT count(DISTINCT user_id) FROM journal_entries WHERE created_at > now() - interval '30 days'),
    'journal_authors', (SELECT count(DISTINCT user_id) FROM journal_entries),
    'entries_total', (SELECT count(*) FROM journal_entries),
    'entries_audio', (SELECT count(*) FROM journal_entries WHERE video_path ~* '\.(m4a|ogg|weba|mp3|wav|aac)$'),
    'entries_video', (SELECT count(*) FROM journal_entries WHERE video_path IS NOT NULL AND video_path !~* '\.(m4a|ogg|weba|mp3|wav|aac)$'),
    'requests_by_status', (SELECT coalesce(jsonb_object_agg(status, c), '{}'::jsonb) FROM (SELECT status, count(*) c FROM therapist_requests GROUP BY status) s),
    'buddy_matches', (SELECT count(*) FROM buddy_matches),
    'therapist_chats', (SELECT count(*) FROM therapist_chats),
    'daily', (SELECT jsonb_agg(jsonb_build_object('day', d::date,
        'signups', (SELECT count(*) FROM profiles p WHERE p.created_at::date = d::date),
        'entries', (SELECT count(*) FROM journal_entries j WHERE j.created_at::date = d::date)) ORDER BY d)
      FROM generate_series(current_date - 29, current_date, interval '1 day') d)
  ) INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_user_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_stats() TO authenticated;