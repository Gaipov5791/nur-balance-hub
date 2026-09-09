-- SLOTS
CREATE TABLE public.therapist_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 50,
  format text NOT NULL DEFAULT 'online',
  is_booked boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_slots TO authenticated;
GRANT ALL ON public.therapist_slots TO service_role;
ALTER TABLE public.therapist_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in read active slots" ON public.therapist_slots FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert slots" ON public.therapist_slots FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update slots" ON public.therapist_slots FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete slots" ON public.therapist_slots FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER therapist_slots_set_updated_at BEFORE UPDATE ON public.therapist_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX therapist_slots_therapist_time_idx ON public.therapist_slots (therapist_id, starts_at);

ALTER TABLE public.therapist_requests
  ADD COLUMN slot_id uuid REFERENCES public.therapist_slots(id) ON DELETE SET NULL,
  ADD COLUMN scheduled_at timestamptz;

-- AUDIT
CREATE TABLE public.therapist_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.therapist_requests(id) ON DELETE CASCADE,
  changed_by uuid,
  from_status text,
  to_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.therapist_request_events TO authenticated;
GRANT ALL ON public.therapist_request_events TO service_role;
ALTER TABLE public.therapist_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own request history" ON public.therapist_request_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapist_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
CREATE POLICY "Admins read all request history" ON public.therapist_request_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX therapist_request_events_request_idx ON public.therapist_request_events (request_id, created_at);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'therapist_request',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

-- STATUS CHANGE TRIGGER: audit + notifications + slot booking
CREATE OR REPLACE FUNCTION public.on_therapist_request_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tname text;
  label text;
  admin_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.therapist_request_events (request_id, changed_by, from_status, to_status)
      VALUES (NEW.id, auth.uid(), NULL, NEW.status);
    IF NEW.slot_id IS NOT NULL THEN
      UPDATE public.therapist_slots SET is_booked = true WHERE id = NEW.slot_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.therapist_request_events (request_id, changed_by, from_status, to_status)
      VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);

    SELECT t.name INTO tname FROM public.therapists t WHERE t.id = NEW.therapist_id;
    label := CASE NEW.status
      WHEN 'new' THEN 'новая'
      WHEN 'in_progress' THEN 'в работе'
      WHEN 'scheduled' THEN 'назначена'
      WHEN 'done' THEN 'завершена'
      WHEN 'cancelled' THEN 'отменена'
      ELSE NEW.status END;

    INSERT INTO public.notifications (user_id, kind, title, body, link)
      VALUES (NEW.user_id, 'therapist_request',
        'Статус заявки обновлён',
        'Заявка к специалисту ' || COALESCE(tname, '') || ': ' || label,
        '/therapists');

    FOR admin_id IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' LOOP
      IF admin_id <> NEW.user_id THEN
        INSERT INTO public.notifications (user_id, kind, title, body, link)
          VALUES (admin_id, 'therapist_request_admin',
            'Заявка: ' || label,
            COALESCE(NULLIF(NEW.client_name, ''), 'Клиент') || ' → ' || COALESCE(tname, 'специалист'),
            '/moderation');
      END IF;
    END LOOP;

    IF NEW.status = 'cancelled' AND NEW.slot_id IS NOT NULL THEN
      UPDATE public.therapist_slots SET is_booked = false WHERE id = NEW.slot_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER therapist_requests_audit
  AFTER INSERT OR UPDATE ON public.therapist_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_therapist_request_change();

-- New requests should also notify admins
CREATE OR REPLACE FUNCTION public.notify_admins_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tname text; admin_id uuid;
BEGIN
  SELECT t.name INTO tname FROM public.therapists t WHERE t.id = NEW.therapist_id;
  FOR admin_id IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link)
      VALUES (admin_id, 'therapist_request_admin', 'Новая заявка к психологу',
        COALESCE(NULLIF(NEW.client_name, ''), 'Клиент') || ' → ' || COALESCE(tname, 'специалист'),
        '/moderation');
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER therapist_requests_notify_admins
  AFTER INSERT ON public.therapist_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_request();