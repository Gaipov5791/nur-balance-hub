-- Daily journal reminder preferences + server-only send stamp.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_time time NOT NULL DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS reminder_timezone text NOT NULL DEFAULT 'Asia/Almaty',
  ADD COLUMN IF NOT EXISTS last_reminder_sent_on date;

COMMENT ON COLUMN public.profiles.reminder_enabled IS 'Send a daily diary reminder at reminder_time.';
COMMENT ON COLUMN public.profiles.reminder_time IS 'Local time of day for the journal reminder.';
COMMENT ON COLUMN public.profiles.reminder_timezone IS 'IANA timezone used to interpret reminder_time.';
COMMENT ON COLUMN public.profiles.last_reminder_sent_on IS 'Local calendar date of the last reminder send; server-only.';

CREATE OR REPLACE FUNCTION public.protect_profile_reminder_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.last_reminder_sent_on IS DISTINCT FROM OLD.last_reminder_sent_on THEN
    IF current_setting('app.allow_reminder_send', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Дату напоминания можно менять только сервером';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_reminder_stamp ON public.profiles;
CREATE TRIGGER profiles_protect_reminder_stamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_reminder_stamp();

CREATE OR REPLACE FUNCTION public.claim_journal_reminder(_user_id uuid, _local_date date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _local_date IS NULL THEN
    RETURN false;
  END IF;
  PERFORM set_config('app.allow_reminder_send', 'on', true);
  UPDATE public.profiles
  SET last_reminder_sent_on = _local_date
  WHERE id = _user_id
    AND reminder_enabled = true
    AND last_reminder_sent_on IS DISTINCT FROM _local_date
    AND last_entry_date IS DISTINCT FROM _local_date;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_journal_reminder(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_journal_reminder(uuid, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_journal_reminder(uuid, date) TO service_role;

-- Lovable Cloud Job: every 15 minutes, POST /api/cron/journal-reminders
-- with Authorization: Bearer <LOVABLE_CRON_SECRET>