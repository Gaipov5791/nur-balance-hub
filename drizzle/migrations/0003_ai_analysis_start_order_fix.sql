-- Refund stale pending analyses before reading the balance, so the refund is never overwritten.
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

  PERFORM 1 FROM public.profiles WHERE id = me FOR UPDATE;
  PERFORM public._wallet_refill(me);
  FOR stale IN SELECT id FROM public.ai_analyses
    WHERE user_id = me AND status = 'pending' AND created_at < now() - interval '10 minutes'
  LOOP
    PERFORM public._analysis_refund(stale.id, 'timeout');
  END LOOP;

  SELECT coins INTO bal FROM public.profiles WHERE id = me;
  bal := COALESCE(bal, 0);

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
    UPDATE public.profiles SET coins = COALESCE(coins, 0) - price WHERE id = me;
    bal := bal - price;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'id', new_id, 'period_start', p_start, 'period_end', today,
    'entries', entries, 'paid_with', pay, 'cost', price, 'coins', bal
  );
END;
$function$;