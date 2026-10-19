-- Stage B: Nur-Coins refill every 3 days, paid AI analysis, subscriptions (read-only until stage C).
-- Amounts must stay in sync with src/lib/economy.ts.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins_refilled_at timestamptz;

CREATE OR REPLACE FUNCTION public.protect_profile_economy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.coins IS DISTINCT FROM OLD.coins
     OR NEW.streak IS DISTINCT FROM OLD.streak
     OR NEW.last_entry_date IS DISTINCT FROM OLD.last_entry_date
     OR NEW.coins_refilled_at IS DISTINCT FROM OLD.coins_refilled_at THEN
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

-- Journal entries keep the day streak for the home screen but no longer pay coins.
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
  new_streak integer;
  new_last date;
  diff integer;
BEGIN
  PERFORM set_config('app.allow_economy', 'on', true);
  SELECT coins, streak, last_entry_date INTO prof
    FROM public.profiles WHERE id = _user_id FOR UPDATE;

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
  IF new_last IS NULL OR _day > new_last THEN
    new_last := _day;
  END IF;

  UPDATE public.profiles SET streak = new_streak, last_entry_date = new_last WHERE id = _user_id;

  RETURN jsonb_build_object(
    'entryId', _entry_id,
    'awards', '[]'::jsonb,
    'total', 0,
    'coins', COALESCE(prof.coins, 0),
    'streak', new_streak
  );
END;
$$;
REVOKE ALL ON FUNCTION public._economy_apply_journal(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.award_action(text);
DROP FUNCTION IF EXISTS public.redeem_catalog_reward(text);
DROP FUNCTION IF EXISTS public._economy_limited_award(uuid, text, integer, uuid, integer);
DROP FUNCTION IF EXISTS public._economy_earned_today(uuid, date);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX subscriptions_user_ends ON public.subscriptions (user_id, ends_at DESC);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscriptions select" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('week', 'month')),
  period_from date NOT NULL,
  period_to date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed', 'deleted')),
  cost integer NOT NULL DEFAULT 0 CHECK (cost >= 0),
  entries_count integer NOT NULL DEFAULT 0,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX ai_analyses_user_time ON public.ai_analyses (user_id, created_at DESC);
GRANT SELECT ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own analyses select" ON public.ai_analyses FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.user_id = _user_id AND s.starts_at <= now() AND s.ends_at > now()
  )
$$;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon, authenticated;

-- Soft-deleted analyses still count, so deleting one does not unlock another free run.
CREATE OR REPLACE FUNCTION public._analysis_free_used(_user_id uuid, _day date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ai_analyses a
     WHERE a.user_id = _user_id
       AND a.cost = 0
       AND a.status <> 'failed'
       AND (a.created_at AT TIME ZONE 'Asia/Almaty')::date = _day
  )
$$;
REVOKE ALL ON FUNCTION public._analysis_free_used(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._analysis_refund(_user_id uuid, _id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE refunded integer;
BEGIN
  UPDATE public.ai_analyses
     SET status = 'failed', finished_at = now()
   WHERE id = _id AND user_id = _user_id AND status = 'pending'
  RETURNING cost INTO refunded;
  IF refunded IS NULL THEN RETURN 0; END IF;
  IF refunded > 0 THEN
    PERFORM set_config('app.allow_economy', 'on', true);
    INSERT INTO public.coin_transactions (user_id, action, amount)
    VALUES (_user_id, 'refund:' || _id::text, refunded);
    UPDATE public.profiles SET coins = coins + refunded WHERE id = _user_id;
  END IF;
  RETURN refunded;
END;
$$;
REVOKE ALL ON FUNCTION public._analysis_refund(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- +15 for every full 3 days since the last refill; the very first call pays immediately.
CREATE OR REPLACE FUNCTION public.claim_coin_refill()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  prof record;
  periods integer;
  anchor timestamptz;
  granted integer := 0;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  PERFORM set_config('app.allow_economy', 'on', true);
  SELECT coins, coins_refilled_at INTO prof FROM public.profiles WHERE id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Профиль не найден'; END IF;

  IF prof.coins_refilled_at IS NULL THEN
    periods := 1;
    anchor := now();
  ELSE
    periods := floor(extract(epoch FROM (now() - prof.coins_refilled_at)) / 259200)::integer;
    anchor := prof.coins_refilled_at + periods * interval '3 days';
  END IF;

  IF periods > 0 THEN
    granted := 15 * periods;
    INSERT INTO public.coin_transactions (user_id, action, amount)
    VALUES (me, 'refill:' || floor(extract(epoch FROM anchor))::bigint::text, granted);
    UPDATE public.profiles
       SET coins = coins + granted, coins_refilled_at = anchor
     WHERE id = me;
  ELSE
    anchor := prof.coins_refilled_at;
  END IF;

  RETURN jsonb_build_object(
    'granted', granted,
    'coins', COALESCE(prof.coins, 0) + granted,
    'nextRefillAt', anchor + interval '3 days'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_coin_refill() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_coin_refill() TO authenticated;

CREATE OR REPLACE FUNCTION public.coin_wallet()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  prof record;
  sub_end timestamptz;
  free_left boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT coins, coins_refilled_at INTO prof FROM public.profiles WHERE id = me;
  SELECT max(s.ends_at) INTO sub_end
    FROM public.subscriptions s
   WHERE s.user_id = me AND s.starts_at <= now() AND s.ends_at > now();
  free_left := sub_end IS NOT NULL
    AND NOT public._analysis_free_used(me, (now() AT TIME ZONE 'Asia/Almaty')::date);
  RETURN jsonb_build_object(
    'coins', COALESCE(prof.coins, 0),
    'nextRefillAt', COALESCE(prof.coins_refilled_at + interval '3 days', now()),
    'refillAmount', 15,
    'analysisCost', CASE WHEN free_left THEN 0 ELSE 15 END,
    'subscribed', sub_end IS NOT NULL,
    'subscriptionEndsAt', sub_end,
    'freeAnalysisAvailable', free_left
  );
END;
$$;
REVOKE ALL ON FUNCTION public.coin_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coin_wallet() TO authenticated;

-- Charges up front; the server refunds via fail_ai_analysis if the AI call fails.
CREATE OR REPLACE FUNCTION public.start_ai_analysis(
  _period text,
  _from date,
  _to date,
  _entries integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  bal integer;
  price integer;
  new_id uuid;
  stale record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _period NOT IN ('week', 'month')
     OR _to - _from <> CASE _period WHEN 'week' THEN 6 ELSE 29 END THEN
    RAISE EXCEPTION 'Некорректный период';
  END IF;
  IF abs(_to - (now() AT TIME ZONE 'utc')::date) > 1 THEN
    RAISE EXCEPTION 'Некорректная дата';
  END IF;
  IF _entries < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_enough');
  END IF;

  PERFORM set_config('app.allow_economy', 'on', true);
  PERFORM 1 FROM public.profiles WHERE id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Профиль не найден'; END IF;

  FOR stale IN
    SELECT a.id FROM public.ai_analyses a
     WHERE a.user_id = me AND a.status = 'pending' AND a.created_at < now() - interval '10 minutes'
  LOOP
    PERFORM public._analysis_refund(me, stale.id);
  END LOOP;

  SELECT coins INTO bal FROM public.profiles WHERE id = me;

  IF EXISTS (SELECT 1 FROM public.ai_analyses a WHERE a.user_id = me AND a.status = 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'busy', 'coins', bal);
  END IF;

  price := CASE
    WHEN public.has_active_subscription(me)
         AND NOT public._analysis_free_used(me, (now() AT TIME ZONE 'Asia/Almaty')::date) THEN 0
    ELSE 15
  END;
  IF bal < price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'coins', bal, 'cost', price);
  END IF;

  INSERT INTO public.ai_analyses (user_id, period, period_from, period_to, cost, entries_count)
  VALUES (me, _period, _from, _to, price, _entries)
  RETURNING id INTO new_id;

  IF price > 0 THEN
    INSERT INTO public.coin_transactions (user_id, action, amount)
    VALUES (me, 'analysis:' || new_id::text, -price);
    UPDATE public.profiles SET coins = coins - price WHERE id = me;
    bal := bal - price;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', new_id, 'cost', price, 'coins', bal);
END;
$$;
REVOKE ALL ON FUNCTION public.start_ai_analysis(text, date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_ai_analysis(text, date, date, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.finish_ai_analysis(_id uuid, _result jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF jsonb_typeof(_result) IS DISTINCT FROM 'object' OR octet_length(_result::text) > 60000 THEN
    RAISE EXCEPTION 'Некорректный результат анализа';
  END IF;
  UPDATE public.ai_analyses
     SET status = 'done', result = _result, finished_at = now()
   WHERE id = _id AND user_id = auth.uid() AND status = 'pending';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_ai_analysis(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_ai_analysis(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.fail_ai_analysis(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  refunded integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  refunded := public._analysis_refund(me, _id);
  RETURN jsonb_build_object(
    'refunded', refunded,
    'coins', (SELECT coins FROM public.profiles WHERE id = me)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.fail_ai_analysis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fail_ai_analysis(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_ai_analysis(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.ai_analyses
     SET status = 'deleted', result = NULL
   WHERE id = _id AND user_id = auth.uid() AND status = 'done';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_ai_analysis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_ai_analysis(uuid) TO authenticated;
