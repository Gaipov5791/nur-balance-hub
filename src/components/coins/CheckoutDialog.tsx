import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, FlaskConical, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCheckout, type CheckoutResult } from "@/hooks/useCoins";
import {
  ANALYSIS_COST,
  COIN_PACK,
  DEMO_COIN_PACKS_PER_DAY,
  SUBSCRIPTION,
  SUBSCRIPTION_RENEW_WINDOW_DAYS,
  coinsWord,
  type Product,
} from "@/lib/economy";

const tenge = new Intl.NumberFormat("ru-RU");

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(iso));
}

const products: Record<
  Product,
  { emoji: string; title: string; note: string; priceKzt: number; suffix: string }
> = {
  coin_pack: {
    emoji: "🪙",
    title: `${COIN_PACK.coins} Нур-Коинов`,
    note: `Хватит на ${Math.floor(COIN_PACK.coins / ANALYSIS_COST)} ИИ-анализов`,
    priceKzt: COIN_PACK.priceKzt,
    suffix: "",
  },
  subscription_month: {
    emoji: "💎",
    title: `Подписка на ${SUBSCRIPTION.days} дней`,
    note: "1 ИИ-анализ в день бесплатно и НурAI без дневного лимита",
    priceKzt: SUBSCRIPTION.priceKzt,
    suffix: " / мес",
  },
};

const blockedText = {
  demo_limit: `В демо-режиме можно купить не больше ${DEMO_COIN_PACKS_PER_DAY} пакетов коинов в день. Попробуй завтра.`,
  too_early: `Подписка уже оплачена надолго вперёд. Продлить можно, когда до конца останется меньше ${SUBSCRIPTION_RENEW_WINDOW_DAYS} дней.`,
} as const;

export function CheckoutDialog({
  product,
  subscribed = false,
  onOpenChange,
}: {
  product: Product | null;
  subscribed?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const checkout = useCheckout();
  const payingRef = useRef(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [shown, setShown] = useState<Product>(product ?? "coin_pack");
  const [prevProduct, setPrevProduct] = useState<Product | null>(null);
  if (product !== prevProduct) {
    setPrevProduct(product);
    if (product) {
      setShown(product);
      setResult(null);
    }
  }

  const item = products[shown];
  const busy = checkout.isPending;
  const renewing = shown === "subscription_month" && subscribed;

  const pay = async () => {
    if (payingRef.current) return;
    payingRef.current = true;
    try {
      setResult(await checkout.mutateAsync(shown));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Оплата не прошла. Попробуй ещё раз");
    } finally {
      payingRef.current = false;
    }
  };

  return (
    <Dialog open={product !== null} onOpenChange={(open) => (busy ? null : onOpenChange(open))}>
      <DialogContent className="max-w-md rounded-3xl">
        {result?.ok ? (
          <div className="py-2 text-center">
            <CheckCircle2 className="mx-auto size-12 text-primary" />
            <DialogHeader className="mt-3 text-center sm:text-center">
              <DialogTitle className="font-display text-lg">
                {result.product === "coin_pack"
                  ? `+${result.coinsAdded} ${coinsWord(result.coinsAdded)} зачислено`
                  : "Подписка активна"}
              </DialogTitle>
              <DialogDescription>
                {result.product === "subscription_month" && result.subscriptionEndsAt
                  ? `До ${formatDay(result.subscriptionEndsAt)}: 1 ИИ-анализ в день бесплатно и НурAI без лимита.`
                  : "Коины уже на балансе."}{" "}
                Это была демо-оплата, деньги не списаны.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-2">
              <Button asChild>
                <Link to="/analysis" onClick={() => onOpenChange(false)}>
                  <Sparkles className="size-4" /> Сделать ИИ-анализ
                </Link>
              </Button>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Готово
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-base">
                {renewing ? "Продление подписки" : "Оплата"}
              </DialogTitle>
              <DialogDescription>Проверь заказ и подтверди оплату.</DialogDescription>
            </DialogHeader>

            <div className="flex items-start gap-3 rounded-2xl border border-coin bg-coin/20 p-3 text-sm">
              <FlaskConical className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold">Демо-оплата.</span> Деньги не списываются — это
                тестовый режим, пока подключаем Kaspi Pay.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
                {item.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {renewing ? `Продлим текущую подписку на ${SUBSCRIPTION.days} дней` : item.note}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {tenge.format(item.priceKzt)} ₸{item.suffix}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-sm">
              <span className="text-muted-foreground">Способ оплаты</span>
              <span className="font-medium">Демо · без списания</span>
            </div>

            {result && !result.ok ? (
              <p className="rounded-2xl bg-secondary p-3 text-sm">{blockedText[result.reason]}</p>
            ) : null}

            <Button size="lg" className="w-full" disabled={busy} onClick={() => void pay()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Проводим оплату…" : `Оплатить ${tenge.format(item.priceKzt)} ₸ (демо)`}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              {shown === "subscription_month"
                ? `Подписка действует ${SUBSCRIPTION.days} дней и не продлевается сама.`
                : "Купленные коины не сгорают."}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
