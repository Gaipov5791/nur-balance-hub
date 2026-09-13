-- Harden Nur-Coins: unique ledger, SECURITY DEFINER awards, block client writes to balance/PIN.
-- Keep amounts in sync with src/lib/economy.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Deduplicate before unique index (keep the newest row).
DELETE FROM public.coin_transactions a
USING public.coin_transactions b
WHERE a.user_id = b.user_id
  AND a.action = b.action
  AND a.created_at < b.created_at;

DELETE FROM public.coin_transactions a
USING public.coin_transactions b
WHERE a.user_id = b.user_id
  AND a.action = b.action
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS coin_transactions_user_action_key
  ON public.coin_transactions (user_id, action);

DROP POLICY IF EXISTS "Users add own coin transactions" ON public.coin_transactions;
REVOKE INSERT ON public.coin_transactions FROM authenticated;

DROP POLICY IF EXISTS "Users can create their own redemptions" ON public.reward_redemptions;
REVOKE INSERT ON public.reward_redemptions FROM authenticated;

-- Stub PIN values were never hashed; wipe them so the real lock starts clean.
UPDATE public.profiles SET pin_code = NULL WHERE pin_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_profile_economy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.coins IS DISTINCT FROM OLD.coins
     OR NEW.streak IS DISTINCT FROM OLD.streak
     OR NEW.last_entry_date IS DISTINCT FROM OLD.last_entry_date THEN
    IF current_setting('app.allow_economy', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Поля баланса можно менять только через функции начисления';
    END IF;
  END IF;
  IF NEW.pin_code IS DISTINCT FROM OLD.pin_code THEN
    IF current_setting('app.allow_pin', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'PIN можно менять только через настройки';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_economy ON public.profiles;
CREATE TRIGGER profiles_protect_economy
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_economy();

CREATE OR REPLACE FUNCTION public._economy_insert(
  _user_id uuid,
  _action text,
  _amount integer,
  _entry_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE inserted integer;
BEGIN
  IF _amount <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.coin_transactions (user_id, action, amount, entry_id)
  VALUES (_user_id, _action, _amount, _entry_id)
  ON CONFLICT (user_id, action) DO NOTHING
  RETURNING amount INTO inserted;
  RETURN COALESCE(inserted, 0);
END;
$$;
REVOKE ALL ON FUNCTION public._economy_insert(uuid, text, integer, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._economy_earned_today(_user_id uuid, _day date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
    FROM public.coin_transactions
   WHERE user_id = _user_id
     AND action IN (
       'journal_daily:' || _day::text,
       'mood:' || _day::text,
       'practice:' || _day::text,
       'buddy:' || _day::text
     );
$$;
REVOKE ALL ON FUNCTION public._economy_earned_today(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._economy_limited_award(
  _user_id uuid,
  _action text,
  _amount integer,
  _entry_id uuid,
  _remaining integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _remaining <= 0 THEN RETURN 0; END IF;
  RETURN public._economy_insert(_user_id, _action, LEAST(_amount, _remaining), _entry_id);
END;
$$;
REVOKE ALL ON FUNCTION public._economy_limited_award(uuid, text, integer, uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._economy_apply_journal(
  _user_id uuid,
  _entry_id uuid,
  _day date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof record;
  remaining integer;
  granted integer;
  total integer := 0;
  awards jsonb := '[]'::jsonb;
  new_streak integer;
  new_last date;
  diff integer;
  bonus integer;
BEGIN
  PERFORM set_config('app.allow_economy', 'on', true);

  SELECT coins, streak, last_entry_date
    INTO prof
    FROM public.profiles
   WHERE id = _user_id
   FOR UPDATE;

  remaining := GREATEST(0, 30 - public._economy_earned_today(_user_id, _day));

  granted := public._economy_limited_award(_user_id, 'journal_daily:' || _day::text, 10, _entry_id, remaining);
  remaining := remaining - granted;
  total := total + granted;
  IF granted > 0 THEN
    awards := awards || jsonb_build_array(jsonb_build_object(
      'action', 'journal_daily:' || _day::text, 'amount', granted, 'label', 'Запись дневника'
    ));
  END IF;

  granted := public._economy_limited_award(_user_id, 'mood:' || _day::text, 5, _entry_id, remaining);
  remaining := remaining - granted;
  total := total + granted;
  IF granted > 0 THEN
    awards := awards || jsonb_build_array(jsonb_build_object(
      'action', 'mood:' || _day::text, 'amount', granted, 'label', 'Эмоция и интенсивность'
    ));
  END IF;

  granted := public._economy_insert(_user_id, 'first_entry', 20, _entry_id);
  total := total + granted;
  IF granted > 0 THEN
    awards := awards || jsonb_build_array(jsonb_build_object(
      'action', 'first_entry', 'amount', granted, 'label', 'Первая запись'
    ));
  END IF;

  new_streak := COALESCE(prof.streak, 0);
  new_last := prof.last_entry_date;
  IF new_last IS NULL THEN
    new_streak := 1;
  ELSE
    diff := (_day - new_last);
    IF diff >= 1 AND diff <= 2 THEN new_streak := new_streak + 1;
    ELSIF diff > 2 THEN new_streak := 1;
    END IF;
  END IF;
  IF new_last IS NULL OR (_day - new_last) > 0 THEN
    new_last := _day;
  END IF;

  bonus := CASE new_streak
    WHEN 3 THEN 10
    WHEN 7 THEN 30
    WHEN 14 THEN 50
    WHEN 30 THEN 100
    ELSE 0
  END;
  IF bonus > 0 THEN
    granted := public._economy_insert(_user_id, 'streak:' || new_streak::text, bonus, _entry_id);
    total := total + granted;
    IF granted > 0 THEN
      awards := awards || jsonb_build_array(jsonb_build_object(
        'action', 'streak:' || new_streak::text, 'amount', granted, 'label', 'Серия ' || new_streak::text || ' дней'
      ));
    END IF;
  END IF;

  UPDATE public.profiles
     SET coins = COALESCE(prof.coins, 0) + total,
         streak = new_streak,
         last_entry_date = new_last
   WHERE id = _user_id;

  RETURN jsonb_build_object(
    'entryId', _entry_id,
    'awards', awards,
    'total', total,
    'coins', COALESCE(prof.coins, 0) + total,
    'streak', new_streak
  );
END;
$$;
REVOKE ALL ON FUNCTION public._economy_apply_journal(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_journal_entry(
  _entry_date date,
  _mood text,
  _level integer,
  _note text,
  _duration integer,
  _video_path text,
  _thumbnail_path text,
  _mime_type text,
  _file_size bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  server_today date := (timezone('utc', now()))::date;
  entry_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _mood NOT IN ('calm', 'joy', 'anxiety', 'sadness', 'tired') THEN
    RAISE EXCEPTION 'Некорректное настроение';
  END IF;
  IF _level < 1 OR _level > 5 THEN
    RAISE EXCEPTION 'Некорректная интенсивность';
  END IF;
  IF _duration < 1 OR _duration > 185 THEN
    RAISE EXCEPTION 'Некорректная длительность';
  END IF;
  IF _video_path IS NULL OR _video_path NOT LIKE me::text || '/%' THEN
    RAISE EXCEPTION 'Недопустимый путь файла';
  END IF;
  IF _thumbnail_path IS NOT NULL AND _thumbnail_path NOT LIKE me::text || '/%' THEN
    RAISE EXCEPTION 'Недопустимый путь файла';
  END IF;
  IF abs(server_today - _entry_date) > 1 THEN
    RAISE EXCEPTION 'Некорректная дата записи';
  END IF;

  INSERT INTO public.journal_entries (
    user_id, entry_date, mood, level, note, duration_seconds,
    video_path, thumbnail_path, mime_type, file_size
  ) VALUES (
    me, _entry_date, _mood, _level, COALESCE(LEFT(_note, 2000), ''), _duration,
    _video_path, _thumbnail_path, _mime_type, COALESCE(_file_size, 0)
  ) RETURNING id INTO entry_id;

  RETURN public._economy_apply_journal(me, entry_id, _entry_date);
END;
$$;
REVOKE ALL ON FUNCTION public.save_journal_entry(date, text, integer, text, integer, text, text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_journal_entry(date, text, integer, text, integer, text, text, text, bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.award_action(_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  day date := (timezone('utc', now()))::date;
  action_id text;
  amount integer;
  label text;
  limited boolean;
  remaining integer;
  granted integer;
  coins integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF _action = 'practice' THEN
    action_id := 'practice:' || day::text; amount := 5; label := 'Практика выполнена'; limited := true;
  ELSIF _action = 'buddy' THEN
    action_id := 'buddy:' || day::text; amount := 5; label := 'Разговор с бадди'; limited := true;
  ELSIF _action = 'profile_complete' THEN
    action_id := 'profile_complete'; amount := 15; label := 'Профиль заполнен'; limited := false;
  ELSE
    RAISE EXCEPTION 'Неизвестное действие';
  END IF;

  PERFORM set_config('app.allow_economy', 'on', true);
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = me FOR UPDATE;
  coins := COALESCE(coins, 0);

  IF limited THEN
    remaining := GREATEST(0, 30 - public._economy_earned_today(me, day));
    granted := public._economy_limited_award(me, action_id, amount, NULL, remaining);
    IF granted = 0 THEN
      IF EXISTS (
        SELECT 1 FROM public.coin_transactions t
         WHERE t.user_id = me AND t.action = action_id
      ) THEN
        RETURN jsonb_build_object('granted', 0, 'coins', coins, 'reason', 'already', 'label', label);
      END IF;
      RETURN jsonb_build_object('granted', 0, 'coins', coins, 'reason', 'limit', 'label', label);
    END IF;
  ELSE
    granted := public._economy_insert(me, action_id, amount, NULL);
    IF granted = 0 THEN
      RETURN jsonb_build_object('granted', 0, 'coins', coins, 'reason', 'already', 'label', label);
    END IF;
  END IF;

  UPDATE public.profiles SET coins = coins + granted WHERE id = me;
  RETURN jsonb_build_object('granted', granted, 'coins', coins + granted, 'reason', 'granted', 'label', label);
END;
$$;
REVOKE ALL ON FUNCTION public.award_action(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_action(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_catalog_reward(_reward_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  cost integer;
  title text;
  coins integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT x.cost, x.title INTO cost, title
    FROM (VALUES
      ('s1', 50, 'Тёмная тема'),
      ('s2', 30, 'Дополнительные иконки настроения'),
      ('s3', 0, 'Бейджи за серию дней'),
      ('s4', 0, 'Значок «Все категории советов»'),
      ('v1', 150, 'Скидка 10% на первую консультацию'),
      ('v2', 300, 'Скидка 20% на консультацию'),
      ('v3', 500, 'Бесплатная 15-минутная встреча')
    ) AS x(id, cost, title)
   WHERE x.id = _reward_id;

  IF cost IS NULL THEN RAISE EXCEPTION 'Награда не найдена'; END IF;

  PERFORM set_config('app.allow_economy', 'on', true);
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = me FOR UPDATE;
  coins := COALESCE(coins, 0);

  IF EXISTS (
    SELECT 1 FROM public.reward_redemptions r
     WHERE r.user_id = me AND r.reward_id = _reward_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'coins', coins, 'reason', 'already');
  END IF;

  IF coins < cost THEN
    RETURN jsonb_build_object('ok', false, 'coins', coins, 'reason', 'insufficient');
  END IF;

  INSERT INTO public.reward_redemptions (user_id, reward_id, title, cost)
  VALUES (me, _reward_id, title, cost);

  IF cost > 0 THEN
    UPDATE public.profiles SET coins = coins - cost WHERE id = me;
    coins := coins - cost;
  END IF;

  RETURN jsonb_build_object('ok', true, 'coins', coins, 'reason', 'redeemed');
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'coins', coins, 'reason', 'already');
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_catalog_reward(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_catalog_reward(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_journal_pin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT pin_code IS NOT NULL FROM public.profiles WHERE id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.has_journal_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_journal_pin() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_journal_pin(_pin text, _current text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  stored text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _pin IS NULL OR _pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN должен состоять из 4 цифр';
  END IF;

  SELECT pin_code INTO stored FROM public.profiles WHERE id = me FOR UPDATE;
  IF stored IS NOT NULL THEN
    IF _current IS NULL OR stored <> extensions.crypt(_current, stored) THEN
      RAISE EXCEPTION 'Неверный текущий PIN';
    END IF;
  END IF;

  PERFORM set_config('app.allow_pin', 'on', true);
  UPDATE public.profiles
     SET pin_code = extensions.crypt(_pin, extensions.gen_salt('bf'))
   WHERE id = me;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.set_journal_pin(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_journal_pin(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_journal_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  stored text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT pin_code INTO stored FROM public.profiles WHERE id = me;
  IF stored IS NULL THEN RETURN true; END IF;
  IF _pin IS NULL OR _pin !~ '^\d{4}$' THEN RETURN false; END IF;
  RETURN stored = extensions.crypt(_pin, stored);
END;
$$;
REVOKE ALL ON FUNCTION public.verify_journal_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_journal_pin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_journal_pin(_current text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  stored text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT pin_code INTO stored FROM public.profiles WHERE id = me FOR UPDATE;
  IF stored IS NULL THEN RETURN true; END IF;
  IF stored <> extensions.crypt(COALESCE(_current, ''), stored) THEN
    RAISE EXCEPTION 'Неверный текущий PIN';
  END IF;
  PERFORM set_config('app.allow_pin', 'on', true);
  UPDATE public.profiles SET pin_code = NULL WHERE id = me;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_journal_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_journal_pin(text) TO authenticated;