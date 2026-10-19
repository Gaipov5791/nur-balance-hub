-- Stage C: demo checkout for the coin pack and the monthly subscription.
-- Prices and limits must stay in sync with src/lib/economy.ts.
-- Kaspi Pay: create_payment() switches provider to 'kaspi'; its webhook (service_role) calls _fulfill_payment().

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product text NOT NULL CHECK (product IN ('coin_pack', 'subscription_month')),
  amount_kzt integer NOT NULL CHECK (amount_kzt > 0),
  coins integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
  provider text NOT NULL DEFAULT 'demo' CHECK (provider IN ('demo', 'kaspi')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
  external_id text,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX payments_user_time ON public.payments (user_id, created_at DESC);
CREATE UNIQUE INDEX payments_provider_external ON public.payments (provider, external_id)
  WHERE external_id IS NOT NULL;
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments select" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Subscribers get a quiet ceiling of 100 NurAI messages a day instead of 30.
CREATE OR REPLACE FUNCTION public.ai_daily_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.has_active_subscription(_user_id) THEN 100 ELSE 30 END
$$;
REVOKE ALL ON FUNCTION public.ai_daily_limit(uuid) FROM PUBLIC, anon, authenticated;

-- Demo payments cost nothing, so they are capped to keep AI spend bounded.
CREATE OR REPLACE FUNCTION public._payment_block_reason(_user_id uuid, _product text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _product = 'coin_pack' AND (
      SELECT count(*) FROM public.payments p
       WHERE p.user_id = _user_id
         AND p.product = 'coin_pack'
         AND p.provider = 'demo'
         AND p.status = 'paid'
         AND (p.paid_at AT TIME ZONE 'Asia/Almaty')::date = (now() AT TIME ZONE 'Asia/Almaty')::date
    ) >= 3 THEN 'demo_limit'
    WHEN _product = 'subscription_month' AND EXISTS (
      SELECT 1 FROM public.subscriptions s
       WHERE s.user_id = _user_id
         AND s.starts_at <= now()
         AND s.ends_at > now() + interval '30 days'
    ) THEN 'too_early'
  END
$$;
REVOKE ALL ON FUNCTION public._payment_block_reason(uuid, text) FROM PUBLIC, anon, authenticated;

-- The only place that credits a purchase. Idempotent: a payment is fulfilled once.
CREATE OR REPLACE FUNCTION public._fulfill_payment(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  sub_id uuid;
  new_end timestamptz;
  bal integer;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Платёж не найден'; END IF;
  IF p.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', p.status = 'paid', 'status', p.status, 'product', p.product);
  END IF;

  PERFORM set_config('app.allow_economy', 'on', true);
  PERFORM 1 FROM public.profiles WHERE id = p.user_id FOR UPDATE;

  IF p.product = 'coin_pack' THEN
    INSERT INTO public.coin_transactions (user_id, action, amount)
    VALUES (p.user_id, 'purchase:' || p.id::text, p.coins);
    UPDATE public.profiles SET coins = coins + p.coins WHERE id = p.user_id;
  ELSE
    UPDATE public.subscriptions s
       SET ends_at = s.ends_at + interval '30 days',
           is_demo = s.is_demo AND p.provider = 'demo'
     WHERE s.id = (
       SELECT x.id FROM public.subscriptions x
        WHERE x.user_id = p.user_id AND x.starts_at <= now() AND x.ends_at > now()
        ORDER BY x.ends_at DESC
        LIMIT 1
     )
    RETURNING s.id, s.ends_at INTO sub_id, new_end;
    IF sub_id IS NULL THEN
      INSERT INTO public.subscriptions (user_id, plan, starts_at, ends_at, is_demo)
      VALUES (p.user_id, 'monthly', now(), now() + interval '30 days', p.provider = 'demo')
      RETURNING id, ends_at INTO sub_id, new_end;
    END IF;
  END IF;

  UPDATE public.payments
     SET status = 'paid', paid_at = now(), subscription_id = sub_id
   WHERE id = p.id;
  SELECT coins INTO bal FROM public.profiles WHERE id = p.user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'product', p.product,
    'coinsAdded', p.coins,
    'coins', COALESCE(bal, 0),
    'subscriptionEndsAt', new_end
  );
END;
$$;
REVOKE ALL ON FUNCTION public._fulfill_payment(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_payment(_product text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  price integer;
  pack integer := 0;
  reason text;
  new_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _product = 'coin_pack' THEN
    price := 1890;
    pack := 230;
  ELSIF _product = 'subscription_month' THEN
    price := 2150;
  ELSE
    RAISE EXCEPTION 'Неизвестный товар';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Профиль не найден'; END IF;

  reason := public._payment_block_reason(me, _product);
  IF reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', reason);
  END IF;

  INSERT INTO public.payments (user_id, product, amount_kzt, coins, provider)
  VALUES (me, _product, price, pack, 'demo')
  RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', new_id,
    'provider', 'demo',
    'product', _product,
    'amountKzt', price,
    'coins', pack
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_payment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment(text) TO authenticated;

-- Demo stand-in for the provider callback; refuses anything that is not a demo payment.
CREATE OR REPLACE FUNCTION public.confirm_demo_payment(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  p record;
  reason text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = me FOR UPDATE;
  SELECT user_id, provider, product, status INTO p FROM public.payments WHERE id = _id;
  IF NOT FOUND OR p.user_id <> me OR p.provider <> 'demo' THEN
    RAISE EXCEPTION 'Платёж не найден';
  END IF;
  IF p.status = 'pending' THEN
    reason := public._payment_block_reason(me, p.product);
    IF reason IS NOT NULL THEN
      UPDATE public.payments SET status = 'cancelled' WHERE id = _id;
      RETURN jsonb_build_object('ok', false, 'reason', reason);
    END IF;
  END IF;
  RETURN public._fulfill_payment(_id);
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_demo_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_demo_payment(uuid) TO authenticated;
