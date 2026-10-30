CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('subscription','coin_pack')),
  amount_kzt integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  provider text NOT NULL DEFAULT 'freedompay',
  provider_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own orders readable" ON public.payment_orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX ON public.payment_orders (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fulfill_payment_order(_order_id uuid, _provider_payment_id text, _amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o record; s record;
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF o.status = 'paid' THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;
  IF _amount <> o.amount_kzt THEN RETURN jsonb_build_object('ok', false, 'reason', 'amount'); END IF;
  UPDATE public.payment_orders SET status='paid', paid_at=now(), provider_payment_id=_provider_payment_id WHERE id=o.id;
  IF o.kind = 'coin_pack' THEN
    PERFORM set_config('app.allow_economy', 'on', true);
    INSERT INTO public.coin_transactions (user_id, action, amount) VALUES (o.user_id, 'pay_pack:' || o.id::text, 230);
    UPDATE public.profiles SET coins = COALESCE(coins,0) + 230 WHERE id = o.user_id;
  ELSE
    SELECT * INTO s FROM public.subscriptions WHERE user_id=o.user_id AND status='active' AND current_period_end > now()
      ORDER BY current_period_end DESC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.subscriptions SET current_period_end = current_period_end + interval '30 days', updated_at=now() WHERE id=s.id;
    ELSE
      INSERT INTO public.subscriptions (user_id, plan, status, provider, price_kzt, started_at, current_period_end)
      VALUES (o.user_id, 'monthly', 'active', 'freedompay', o.amount_kzt, now(), now() + interval '30 days');
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.fulfill_payment_order(uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_payment_order(uuid,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_payment_order(_order_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.payment_orders SET status='failed' WHERE id=_order_id AND status='pending';
$$;
REVOKE ALL ON FUNCTION public.fail_payment_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_payment_order(uuid) TO service_role;