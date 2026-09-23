ALTER TABLE public.therapist_requests
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 50;

CREATE OR REPLACE FUNCTION public.is_request_therapist(_request_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.therapist_requests r
    JOIN public.therapists t ON t.id = r.therapist_id
    WHERE r.id = _request_id AND t.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_own_therapist_card(_therapist_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = _therapist_id AND t.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Therapists read own requests" ON public.therapist_requests;
CREATE POLICY "Therapists read own requests"
ON public.therapist_requests FOR SELECT TO authenticated
USING (public.is_own_therapist_card(therapist_id, auth.uid()));

DROP POLICY IF EXISTS "Therapists update own requests" ON public.therapist_requests;
CREATE POLICY "Therapists update own requests"
ON public.therapist_requests FOR UPDATE TO authenticated
USING (public.is_own_therapist_card(therapist_id, auth.uid()))
WITH CHECK (public.is_own_therapist_card(therapist_id, auth.uid()));

DROP POLICY IF EXISTS "Therapists manage own slots" ON public.therapist_slots;
CREATE POLICY "Therapists manage own slots"
ON public.therapist_slots FOR ALL TO authenticated
USING (public.is_own_therapist_card(therapist_id, auth.uid()))
WITH CHECK (public.is_own_therapist_card(therapist_id, auth.uid()));

DROP POLICY IF EXISTS "Therapists read own request history" ON public.therapist_request_events;
CREATE POLICY "Therapists read own request history"
ON public.therapist_request_events FOR SELECT TO authenticated
USING (public.is_request_therapist(request_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.on_therapist_request_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  tname text;
  label text;
  admin_id uuid;
  slot_start timestamptz;
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
      WHEN 'new' THEN 'ожидает подтверждения'
      WHEN 'in_progress' THEN 'в работе'
      WHEN 'scheduled' THEN 'подтверждена'
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

    IF NEW.status = 'scheduled' AND NEW.slot_id IS NOT NULL THEN
      SELECT s.starts_at INTO slot_start FROM public.therapist_slots s WHERE s.id = NEW.slot_id;
      IF slot_start IS NOT NULL THEN
        NEW.scheduled_at := slot_start;
      END IF;
      UPDATE public.therapist_slots SET is_booked = true WHERE id = NEW.slot_id;
    END IF;

    IF NEW.status = 'cancelled' AND NEW.slot_id IS NOT NULL THEN
      UPDATE public.therapist_slots SET is_booked = false WHERE id = NEW.slot_id;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS therapist_requests_audit ON public.therapist_requests;
CREATE TRIGGER therapist_requests_audit
AFTER INSERT ON public.therapist_requests
FOR EACH ROW EXECUTE FUNCTION public.on_therapist_request_change();

CREATE OR REPLACE FUNCTION public.on_therapist_request_status_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE slot_start timestamptz;
BEGIN
  IF NEW.status = 'scheduled' AND OLD.status IS DISTINCT FROM 'scheduled' AND NEW.slot_id IS NOT NULL THEN
    SELECT s.starts_at INTO slot_start FROM public.therapist_slots s WHERE s.id = NEW.slot_id;
    IF slot_start IS NOT NULL THEN
      NEW.scheduled_at := slot_start;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS therapist_requests_fix_schedule ON public.therapist_requests;
CREATE TRIGGER therapist_requests_fix_schedule
BEFORE UPDATE ON public.therapist_requests
FOR EACH ROW EXECUTE FUNCTION public.on_therapist_request_status_before();
