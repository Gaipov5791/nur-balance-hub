-- Stage B: AI mood analyzer, new Nur-Coins economy (+15 every 3 days, analysis costs 15), subscriptions.

-- 1. Refill clock on profiles (protected like coins).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coin_refill_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.protect_profile_economy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.coins IS DISTINCT FROM OLD.coins
     OR NEW.streak IS DISTINCT FROM OLD.streak
     OR NEW.last_entry_date IS DISTINCT FROM OLD.last_entry_date
     OR NEW.coin_refill_at IS DISTINCT FROM OLD.coin_refill_at THEN
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
$function$;

-- 2. Subscriptions (written only by server functions; demo payments in stage C).
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'premium',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  provider text NOT NULL DEFAULT 'demo',
  price_kzt integer NOT NULL DEFAULT 2150,
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_period_idx ON public.subscriptions (user_id, current_period_end DESC);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.user_id = _user_id AND s.status = 'active' AND s.current_period_end > now()
  )
$$;

-- NurAI: 30/day free, silent Fair Use 100/day with subscription.
CREATE OR REPLACE FUNCTION public.ai_daily_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT CASE WHEN public.has_active_subscription(_user_id) THEN 100 ELSE 30 END $$;

-- 3. AI analyses (owner-only; mental-health data is not shown to staff).
CREATE TABLE public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period text NOT NULL CHECK (period IN ('week', 'month')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  entries_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  paid_with text NOT NULL CHECK (paid_with IN ('coins', 'subscription')),
  cost integer NOT NULL DEFAULT 0,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ai_analyses_user_created_idx ON public.ai_analyses (user_id, created_at DESC);

GRANT SELECT ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own analyses" ON public.ai_analyses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. Wallet: applies accrued refills (+15 per full 3 days, no cap) and returns the balance state.
CREATE OR REPLACE FUNCTION public._wallet_refill(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prof record;
  periods integer;
  amount integer;
  new_at timestamptz;
BEGIN
  SELECT coins, coin_refill_at INTO prof FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  periods := floor(extract(epoch FROM (now() - prof.coin_refill_at)) / 259200)::integer;
  IF periods <= 0 THEN RETURN 0; END IF;
  amount := periods * 15;
  new_at := prof.coin_refill_at + make_interval(days => periods * 3);
  PERFORM set_config('app.allow_economy', 'on', true);
  INSERT INTO public.coin_transactions (user_id, action, amount)
  VALUES (_user_id, 'refill:' || floor(extract(epoch FROM new_at))::bigint::text, amount)
  ON CONFLICT (user_id, action) DO NOTHING;
  UPDATE public.profiles SET coins = COALESCE(coins, 0) + amount, coin_refill_at = new_at WHERE id = _user_id;
  RETURN amount;
END;
$function$;

CREATE OR REPLACE FUNCTION public._analysis_refund(_id uuid, _error text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE a record;
BEGIN
  UPDATE public.ai_analyses
     SET status = 'failed', error = LEFT(COALESCE(_error, ''), 500), completed_at = now()
   WHERE id = _id AND status = 'pending'
   RETURNING user_id, cost, paid_with INTO a;
  IF NOT FOUND THEN RETURN false; END IF;
  IF a.paid_with = 'coins' AND a.cost > 0 THEN
    PERFORM set_config('app.allow_economy', 'on', true);
    INSERT INTO public.coin_transactions (user_id, action, amount)
    VALUES (a.user_id, 'analysis_refund:' || _id::text, a.cost)
    ON CONFLICT (user_id, action) DO NOTHING;
    UPDATE public.profiles SET coins = COALESCE(coins, 0) + a.cost WHERE id = a.user_id;
  END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.coin_wallet()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  granted integer;
  prof record;
  sub record;
  today date := (now() AT TIME ZONE 'Asia/Almaty')::date;
  free_used boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  granted := public._wallet_refill(me);
  SELECT coins, coin_refill_at INTO prof FROM public.profiles WHERE id = me;
  SELECT s.current_period_end INTO sub FROM public.subscriptions s
   WHERE s.user_id = me AND s.status = 'active' AND s.current_period_end > now()
   ORDER BY s.current_period_end DESC LIMIT 1;
  free_used := EXISTS (
    SELECT 1 FROM public.ai_analyses a
     WHERE a.user_id = me AND a.paid_with = 'subscription' AND a.status IN ('pending', 'done')
       AND (a.created_at AT TIME ZONE 'Asia/Almaty')::date = today
  );
  RETURN jsonb_build_object(
    'coins', COALESCE(prof.coins, 0),
    'refilled', granted,
    'refill_amount', 15,
    'refill_every_days', 3,
    'next_refill_at', prof.coin_refill_at + interval '3 days',
    'analysis_cost', 15,
    'subscription_active', sub.current_period_end IS NOT NULL,
    'subscription_until', sub.current_period_end,
    'free_analysis_available', sub.current_period_end IS NOT NULL AND NOT free_used,
    'ai_daily_limit', public.ai_daily_limit(me)
  );
END;
$function$;

-- 5. Analysis lifecycle: start (charges coins or uses the daily subscription analysis), complete/fail (server only).
CREATE OR REPLACE FUNCTION public.start_ai_analysis(_period text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Asia/Almaty')::date;
  p_start date;
  entries integer;
  stale record;
  bal integer;
  pay text;
  price integer := 0;
  new_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _period NOT IN ('week', 'month') THEN RAISE EXCEPTION 'Некорректный период'; END IF;
  p_start := today - CASE WHEN _period = 'week' THEN 6 ELSE 29 END;

  PERFORM public._wallet_refill(me);
  SELECT coins INTO bal FROM public.profiles WHERE id = me FOR UPDATE;
  bal := COALESCE(bal, 0);

  FOR stale IN SELECT id FROM public.ai_analyses
    WHERE user_id = me AND status = 'pending' AND created_at < now() - interval '10 minutes'
  LOOP
    PERFORM public._analysis_refund(stale.id, 'timeout');
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.ai_analyses WHERE user_id = me AND status = 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'busy', 'coins', bal);
  END IF;

  SELECT
    (SELECT count(*) FROM public.mood_checkins m
      WHERE m.user_id = me AND (m.created_at AT TIME ZONE 'Asia/Almaty')::date BETWEEN p_start AND today)
    + (SELECT count(*) FROM public.journal_entries j
      WHERE j.user_id = me AND j.entry_date BETWEEN p_start AND today)
    INTO entries;
  IF entries < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_enough', 'entries', entries, 'coins', bal);
  END IF;

  IF public.has_active_subscription(me) AND NOT EXISTS (
    SELECT 1 FROM public.ai_analyses a
     WHERE a.user_id = me AND a.paid_with = 'subscription' AND a.status IN ('pending', 'done')
       AND (a.created_at AT TIME ZONE 'Asia/Almaty')::date = today
  ) THEN
    pay := 'subscription';
  ELSIF bal < 15 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'coins', bal, 'cost', 15);
  ELSE
    pay := 'coins';
    price := 15;
  END IF;

  INSERT INTO public.ai_analyses (user_id, period, period_start, period_end, entries_count, paid_with, cost)
  VALUES (me, _period, p_start, today, entries, pay, price)
  RETURNING id INTO new_id;

  IF price > 0 THEN
    PERFORM set_config('app.allow_economy', 'on', true);
    INSERT INTO public.coin_transactions (user_id, action, amount)
    VALUES (me, 'analysis:' || new_id::text, -price);
    UPDATE public.profiles SET coins = bal - price WHERE id = me;
    bal := bal - price;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'id', new_id, 'period_start', p_start, 'period_end', today,
    'entries', entries, 'paid_with', pay, 'cost', price, 'coins', bal
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_ai_analysis(_id uuid, _result jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.ai_analyses
     SET status = 'done', result = _result, completed_at = now()
   WHERE id = _id AND status = 'pending';
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_ai_analysis(_id uuid, _error text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public._analysis_refund(_id, _error) $$;

REVOKE ALL ON FUNCTION public._wallet_refill(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._analysis_refund(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ai_analysis(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_ai_analysis(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ai_analysis(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_ai_analysis(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.coin_wallet() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_ai_analysis(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coin_wallet() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_ai_analysis(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;

-- 6. Retire old earning and the rewards shop; existing balances stay untouched.
CREATE OR REPLACE FUNCTION public._economy_apply_journal(_user_id uuid, _entry_id uuid, _day date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prof record;
  new_streak integer;
  new_last date;
  diff integer;
BEGIN
  PERFORM set_config('app.allow_economy', 'on', true);
  SELECT coins, streak, last_entry_date INTO prof FROM public.profiles WHERE id = _user_id FOR UPDATE;
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
  IF new_last IS NULL OR (_day - new_last) > 0 THEN new_last := _day; END IF;
  UPDATE public.profiles SET streak = new_streak, last_entry_date = new_last WHERE id = _user_id;
  RETURN jsonb_build_object('entryId', _entry_id, 'awards', '[]'::jsonb, 'total', 0,
    'coins', COALESCE(prof.coins, 0), 'streak', new_streak);
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_action(_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); bal integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT coins INTO bal FROM public.profiles WHERE id = me;
  RETURN jsonb_build_object('granted', 0, 'coins', COALESCE(bal, 0), 'reason', 'already', 'label', '');
END;
$function$;
COMMENT ON FUNCTION public.award_action(text) IS 'DEPRECATED: old per-action coin earning retired in stage B; always grants 0';

CREATE OR REPLACE FUNCTION public.redeem_catalog_reward(_reward_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Магазин наград закрыт';
END;
$function$;
COMMENT ON FUNCTION public.redeem_catalog_reward(text) IS 'DEPRECATED: rewards shop removed in stage B';
COMMENT ON TABLE public.reward_redemptions IS 'DEPRECATED: rewards shop removed in stage B; kept for history';