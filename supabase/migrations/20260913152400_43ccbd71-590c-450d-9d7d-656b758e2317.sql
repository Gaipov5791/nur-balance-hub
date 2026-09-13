-- lovable-cron-fallback-reviewed: 96 runs/day; reminders fire at each user's chosen local time in their own timezone, so the sweep must run at least as often as the 15-minute reminder window; no row event exists to trigger on.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'reminder_cron_secret') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'reminder_cron_secret'),
      'fc74c74dfc246c5e293ffecd9311387900f9577a77dedd3d',
      'reminder_cron_secret'
    );
  ELSE
    PERFORM vault.create_secret(
      'fc74c74dfc246c5e293ffecd9311387900f9577a77dedd3d',
      'reminder_cron_secret',
      'Bearer token for the journal reminder cron endpoint'
    );
  END IF;
END;
$$;

SELECT cron.unschedule('journal-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'journal-reminders');

SELECT cron.schedule(
  'journal-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--2c3b2d4a-9148-4b9a-b1cc-8e368557f518.lovable.app/api/cron/journal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);