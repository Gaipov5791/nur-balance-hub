CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, coins)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    15
  )
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.coin_transactions (user_id, action, amount)
    VALUES (NEW.id, 'welcome', 15) ON CONFLICT (user_id, action) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.demo_buy_coin_pack()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Нужно войти'; END IF;
  PERFORM set_config('app.allow_economy', 'on', true);
  INSERT INTO public.coin_transactions (user_id, action, amount)
  VALUES (uid, 'demo_pack:' || gen_random_uuid()::text, 230);
  UPDATE public.profiles SET coins = COALESCE(coins, 0) + 230 WHERE id = uid RETURNING coins INTO bal;
  RETURN jsonb_build_object('added', 230, 'coins', bal);
END;
$function$;

CREATE OR REPLACE FUNCTION public.demo_subscribe()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); s record; until_at timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Нужно войти'; END IF;
  SELECT * INTO s FROM public.subscriptions
   WHERE user_id = uid AND status = 'active' AND current_period_end > now()
   ORDER BY current_period_end DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.subscriptions SET current_period_end = current_period_end + interval '30 days', updated_at = now()
     WHERE id = s.id RETURNING current_period_end INTO until_at;
  ELSE
    INSERT INTO public.subscriptions (user_id, plan, status, provider, price_kzt, started_at, current_period_end)
    VALUES (uid, 'monthly', 'active', 'demo', 2150, now(), now() + interval '30 days')
    RETURNING current_period_end INTO until_at;
  END IF;
  RETURN jsonb_build_object('until', until_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.demo_cancel_subscription()
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Нужно войти'; END IF;
  UPDATE public.subscriptions SET status = 'canceled', canceled_at = now(), updated_at = now()
   WHERE user_id = uid AND status = 'active';
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.demo_buy_coin_pack() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.demo_subscribe() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.demo_cancel_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_buy_coin_pack() TO authenticated;
GRANT EXECUTE ON FUNCTION public.demo_subscribe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.demo_cancel_subscription() TO authenticated;