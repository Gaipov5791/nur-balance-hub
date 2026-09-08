
CREATE TABLE public.buddy_queue (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  life_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buddy_queue TO authenticated;
GRANT ALL ON public.buddy_queue TO service_role;
ALTER TABLE public.buddy_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own queue row" ON public.buddy_queue FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.buddy_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  life_status text,
  status text NOT NULL DEFAULT 'active',
  ended_by uuid,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buddy_matches_user_a_idx ON public.buddy_matches (user_a) WHERE status = 'active';
CREATE INDEX buddy_matches_user_b_idx ON public.buddy_matches (user_b) WHERE status = 'active';
GRANT SELECT ON public.buddy_matches TO authenticated;
GRANT ALL ON public.buddy_matches TO service_role;
ALTER TABLE public.buddy_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read own matches" ON public.buddy_matches FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Admins read all matches" ON public.buddy_matches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_match_participant(_match_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buddy_matches m
    WHERE m.id = _match_id AND (m.user_a = _user_id OR m.user_b = _user_id)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_match_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_match_participant(uuid, uuid) TO authenticated, service_role;

CREATE TABLE public.buddy_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.buddy_matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text',
  body text NOT NULL DEFAULT '',
  media_path text,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buddy_messages_kind_chk CHECK (kind IN ('text','audio','video')),
  CONSTRAINT buddy_messages_body_chk CHECK (char_length(body) <= 2000)
);
CREATE INDEX buddy_messages_match_idx ON public.buddy_messages (match_id, created_at);
GRANT SELECT, INSERT ON public.buddy_messages TO authenticated;
GRANT ALL ON public.buddy_messages TO service_role;
ALTER TABLE public.buddy_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.buddy_messages FOR SELECT TO authenticated
  USING (public.is_match_participant(match_id, auth.uid()));
CREATE POLICY "Admins read messages" ON public.buddy_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants send messages" ON public.buddy_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_match_participant(match_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.buddy_matches m WHERE m.id = match_id AND m.status = 'active')
  );

ALTER TABLE public.buddy_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buddy_messages;

CREATE TABLE public.buddy_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, blocked_user_id)
);
GRANT SELECT ON public.buddy_blocks TO authenticated;
GRANT ALL ON public.buddy_blocks TO service_role;
ALTER TABLE public.buddy_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own blocks" ON public.buddy_blocks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.buddy_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.buddy_matches(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buddy_reports_status_idx ON public.buddy_reports (status, created_at DESC);
GRANT SELECT ON public.buddy_reports TO authenticated;
GRANT UPDATE ON public.buddy_reports TO authenticated;
GRANT ALL ON public.buddy_reports TO service_role;
ALTER TABLE public.buddy_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporters read own reports" ON public.buddy_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);
CREATE POLICY "Admins read all reports" ON public.buddy_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update reports" ON public.buddy_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.find_or_queue_buddy(_life_status text)
RETURNS TABLE (match_id uuid, matched boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); partner uuid; mid uuid; existing uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT m.id INTO existing FROM public.buddy_matches m
   WHERE m.status = 'active' AND (m.user_a = me OR m.user_b = me) LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN QUERY SELECT existing, true; RETURN;
  END IF;

  SELECT q.user_id INTO partner FROM public.buddy_queue q
   WHERE q.user_id <> me
     AND NOT EXISTS (
       SELECT 1 FROM public.buddy_blocks b
        WHERE (b.user_id = me AND b.blocked_user_id = q.user_id)
           OR (b.user_id = q.user_id AND b.blocked_user_id = me))
     AND NOT EXISTS (
       SELECT 1 FROM public.buddy_matches m
        WHERE m.status = 'active' AND (m.user_a = q.user_id OR m.user_b = q.user_id))
   ORDER BY (q.life_status IS NOT DISTINCT FROM _life_status) DESC, q.created_at
   LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF partner IS NULL THEN
    INSERT INTO public.buddy_queue (user_id, life_status) VALUES (me, _life_status)
      ON CONFLICT (user_id) DO UPDATE SET life_status = EXCLUDED.life_status, created_at = now();
    RETURN QUERY SELECT NULL::uuid, false; RETURN;
  END IF;

  DELETE FROM public.buddy_queue WHERE user_id IN (me, partner);
  INSERT INTO public.buddy_matches (user_a, user_b, life_status)
    VALUES (partner, me, _life_status) RETURNING id INTO mid;
  RETURN QUERY SELECT mid, true;
END $$;
REVOKE EXECUTE ON FUNCTION public.find_or_queue_buddy(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_queue_buddy(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.active_buddy_match()
RETURNS TABLE (match_id uuid, partner_id uuid, partner_name text, partner_status text, started_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id,
         p.id,
         COALESCE(NULLIF(p.name, ''), 'Собеседница'),
         p.life_status,
         m.created_at
    FROM public.buddy_matches m
    JOIN public.profiles p
      ON p.id = CASE WHEN m.user_a = auth.uid() THEN m.user_b ELSE m.user_a END
   WHERE m.status = 'active' AND auth.uid() IN (m.user_a, m.user_b)
   LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.active_buddy_match() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_buddy_match() TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_buddy_match(_match_id uuid, _block boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); other uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT CASE WHEN m.user_a = me THEN m.user_b ELSE m.user_a END INTO other
    FROM public.buddy_matches m
   WHERE m.id = _match_id AND (m.user_a = me OR m.user_b = me);
  IF other IS NULL THEN RETURN false; END IF;

  UPDATE public.buddy_matches
     SET status = 'ended', ended_by = me, ended_at = now()
   WHERE id = _match_id AND status = 'active';

  IF _block THEN
    INSERT INTO public.buddy_blocks (user_id, blocked_user_id)
      VALUES (me, other) ON CONFLICT DO NOTHING;
  END IF;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.leave_buddy_match(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_buddy_match(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_buddy_queue()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.buddy_queue WHERE user_id = auth.uid();
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.leave_buddy_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_buddy_queue() TO authenticated;

CREATE OR REPLACE FUNCTION public.report_buddy(_match_id uuid, _reason text, _details text DEFAULT '')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); other uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT CASE WHEN m.user_a = me THEN m.user_b ELSE m.user_a END INTO other
    FROM public.buddy_matches m
   WHERE m.id = _match_id AND (m.user_a = me OR m.user_b = me);
  IF other IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;

  INSERT INTO public.buddy_reports (match_id, reporter_id, reported_id, reason, details)
    VALUES (_match_id, me, other, COALESCE(NULLIF(_reason, ''), 'other'), COALESCE(LEFT(_details, 1000), ''));

  UPDATE public.buddy_matches
     SET status = 'ended', ended_by = me, ended_at = now()
   WHERE id = _match_id AND status = 'active';

  INSERT INTO public.buddy_blocks (user_id, blocked_user_id) VALUES (me, other)
    ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.report_buddy(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_buddy(uuid, text, text) TO authenticated;

CREATE POLICY "Participants read buddy media" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'buddy-media'
    AND public.is_match_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "Participants upload buddy media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'buddy-media'
    AND public.is_match_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "Admins read buddy media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'buddy-media' AND public.has_role(auth.uid(), 'admin'));
