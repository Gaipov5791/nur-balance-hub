-- Telegram link of a therapist card to a Telegram chat
CREATE TABLE public.therapist_telegram (
  therapist_id uuid PRIMARY KEY REFERENCES public.therapists(id) ON DELETE CASCADE,
  chat_id bigint NOT NULL,
  tg_username text,
  linked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.therapist_telegram TO authenticated;
GRANT ALL ON public.therapist_telegram TO service_role;
ALTER TABLE public.therapist_telegram ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapist reads own telegram link" ON public.therapist_telegram
  FOR SELECT TO authenticated
  USING (public.is_own_therapist_card(therapist_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- One-time codes used in the t.me/<bot>?start=<code> deep link
CREATE TABLE public.telegram_link_codes (
  code text PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_link_codes TO service_role;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- Outbox of Telegram messages to therapists
CREATE TABLE public.telegram_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.therapist_requests(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('new_request','status_changed','reminder_24h','reminder_1h','test')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz
);
GRANT ALL ON public.telegram_outbox TO service_role;
ALTER TABLE public.telegram_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX telegram_outbox_pending_idx ON public.telegram_outbox (status, created_at);

-- Therapist creates a deep-link code for their own card
CREATE OR REPLACE FUNCTION public.create_telegram_link_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
  new_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT t.id INTO tid FROM public.therapists t WHERE t.user_id = auth.uid() LIMIT 1;
  IF tid IS NULL THEN RAISE EXCEPTION 'no therapist card'; END IF;
  DELETE FROM public.telegram_link_codes WHERE therapist_id = tid OR expires_at < now();
  new_code := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.telegram_link_codes (code, therapist_id, expires_at)
    VALUES (new_code, tid, now() + interval '30 minutes');
  RETURN new_code;
END $$;
REVOKE ALL ON FUNCTION public.create_telegram_link_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_telegram_link_code() TO authenticated;

-- Therapist disconnects Telegram from their card
CREATE OR REPLACE FUNCTION public.unlink_my_telegram()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM public.therapist_telegram tt
    USING public.therapists t
    WHERE t.id = tt.therapist_id AND t.user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.unlink_my_telegram() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_my_telegram() TO authenticated;

-- Bot webhook consumes a code (server only)
CREATE OR REPLACE FUNCTION public.consume_telegram_link_code(_code text, _chat_id bigint, _username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
  tname text;
BEGIN
  DELETE FROM public.telegram_link_codes
    WHERE code = _code AND expires_at > now()
    RETURNING therapist_id INTO tid;
  IF tid IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.therapist_telegram (therapist_id, chat_id, tg_username, linked_at)
    VALUES (tid, _chat_id, NULLIF(_username, ''), now())
    ON CONFLICT (therapist_id) DO UPDATE
      SET chat_id = EXCLUDED.chat_id, tg_username = EXCLUDED.tg_username, linked_at = now();
  SELECT name INTO tname FROM public.therapists WHERE id = tid;
  RETURN COALESCE(tname, '');
END $$;
REVOKE ALL ON FUNCTION public.consume_telegram_link_code(text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_telegram_link_code(text, bigint, text) TO service_role;

-- Queue messages on new requests and on status changes made by someone other than the therapist
CREATE OR REPLACE FUNCTION public.enqueue_therapist_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  therapist_user uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.therapist_telegram WHERE therapist_id = NEW.therapist_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.telegram_outbox (therapist_id, request_id, kind, dedupe_key)
      VALUES (NEW.therapist_id, NEW.id, 'new_request', 'new:' || NEW.id)
      ON CONFLICT (dedupe_key) DO NOTHING;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT user_id INTO therapist_user FROM public.therapists WHERE id = NEW.therapist_id;
    IF auth.uid() IS DISTINCT FROM therapist_user THEN
      INSERT INTO public.telegram_outbox (therapist_id, request_id, kind, payload)
        VALUES (NEW.therapist_id, NEW.id, 'status_changed',
          jsonb_build_object('from', OLD.status, 'to', NEW.status,
            'by_client', auth.uid() IS NOT DISTINCT FROM NEW.user_id));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS therapist_requests_telegram ON public.therapist_requests;
CREATE TRIGGER therapist_requests_telegram
AFTER INSERT OR UPDATE OF status ON public.therapist_requests
FOR EACH ROW EXECUTE FUNCTION public.enqueue_therapist_telegram();

-- Queue 24h / 1h reminders for confirmed consultations (server only)
CREATE OR REPLACE FUNCTION public.enqueue_telegram_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n1 integer := 0;
  n2 integer := 0;
BEGIN
  INSERT INTO public.telegram_outbox (therapist_id, request_id, kind, dedupe_key)
    SELECT r.therapist_id, r.id, 'reminder_24h', 'r24:' || r.id || ':' || r.scheduled_at
    FROM public.therapist_requests r
    JOIN public.therapist_telegram tt ON tt.therapist_id = r.therapist_id
    WHERE r.status = 'scheduled'
      AND r.scheduled_at > now() + interval '3 hours'
      AND r.scheduled_at <= now() + interval '24 hours'
    ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS n1 = ROW_COUNT;

  INSERT INTO public.telegram_outbox (therapist_id, request_id, kind, dedupe_key)
    SELECT r.therapist_id, r.id, 'reminder_1h', 'r1:' || r.id || ':' || r.scheduled_at
    FROM public.therapist_requests r
    JOIN public.therapist_telegram tt ON tt.therapist_id = r.therapist_id
    WHERE r.status = 'scheduled'
      AND r.scheduled_at > now()
      AND r.scheduled_at <= now() + interval '75 minutes'
    ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS n2 = ROW_COUNT;
  RETURN n1 + n2;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_telegram_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_telegram_reminders() TO service_role;

-- Claim pending messages for sending (server only); stale "sending" rows are retried
CREATE OR REPLACE FUNCTION public.claim_telegram_outbox(_limit integer DEFAULT 25)
RETURNS SETOF public.telegram_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.telegram_outbox o
    SET status = 'sending', attempts = o.attempts + 1, claimed_at = now()
    WHERE o.id IN (
      SELECT id FROM public.telegram_outbox
      WHERE (status = 'pending' OR (status = 'sending' AND claimed_at < now() - interval '5 minutes'))
        AND attempts < 5
      ORDER BY created_at
      LIMIT LEAST(GREATEST(_limit, 1), 50)
      FOR UPDATE SKIP LOCKED
    )
    RETURNING o.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_telegram_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_outbox(integer) TO service_role;