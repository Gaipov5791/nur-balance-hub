CREATE TABLE public.mood_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  emotions text[] NOT NULL DEFAULT '{}',
  activities text[] NOT NULL DEFAULT '{}',
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mood_checkins_user_time ON public.mood_checkins (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mood_checkins TO authenticated;
GRANT ALL ON public.mood_checkins TO service_role;
ALTER TABLE public.mood_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mood select" ON public.mood_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own mood insert" ON public.mood_checkins FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own mood update" ON public.mood_checkins FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own mood delete" ON public.mood_checkins FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER mood_checkins_set_updated_at BEFORE UPDATE ON public.mood_checkins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.custom_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('emotion','activity')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  emoji text NOT NULL DEFAULT '✨' CHECK (char_length(emoji) <= 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_tags TO authenticated;
GRANT ALL ON public.custom_tags TO service_role;
ALTER TABLE public.custom_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tags all" ON public.custom_tags FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 3 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.app_feedback TO authenticated;
GRANT ALL ON public.app_feedback TO service_role;
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback insert own" ON public.app_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "feedback admin read" ON public.app_feedback FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.notify_admins_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE admin_id uuid;
BEGIN
  FOR admin_id IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (admin_id, 'feedback', 'Новый отзыв о приложении', left(NEW.message, 120), '/moderation');
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER app_feedback_notify AFTER INSERT ON public.app_feedback FOR EACH ROW EXECUTE FUNCTION public.notify_admins_feedback();