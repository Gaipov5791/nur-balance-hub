import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoinHistory, useCoinWallet } from "@/hooks/useCoins";
import {
  ANALYSIS_COST,
  COIN_PACK,
  REFILL_AMOUNT,
  REFILL_INTERVAL_DAYS,
  SUBSCRIPTION_PRICE_KZT,
  coinActionLabel,
  formatRefillIn,
} from "@/lib/economy";

export const Route = createFileRoute("/_authenticated/coins")({
  head: () => ({
    meta: [
      { title: "Нур-Коины — Nur Balance" },
      {
        name: "description",
        content:
          "Баланс Нур-Коинов, когда следующее пополнение и на что их потратить: ИИ-анализ недели или месяца.",
      },
    ],
  }),
  component: CoinsPage,
});

const tenge = new Intl.NumberFormat("ru-RU");

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const rules = [
  {
    emoji: "🗓️",
    text: `+${REFILL_AMOUNT} коинов каждые ${REFILL_INTERVAL_DAYS} дня`,
    note: "Начисляются сами, когда заходишь в приложение. Копятся без ограничений.",
  },
  {
    emoji: "✨",
    text: `ИИ-анализ — ${ANALYSIS_COST} коинов`,
    note: "Разбор недели или месяца по настроению, эмоциям, активностям и дневнику.",
  },
  {
    emoji: "💎",
    text: "С подпиской — 1 анализ в день бесплатно",
    note: "И НурAI без дневного лимита сообщений.",
  },
  {
    emoji: "🪙",
    text: "Накопленные монеты сохранены",
    note: "За дневник, практики и общение коины больше не начисляются.",
  },
];

function CoinsPage() {
  const wallet = useCoinWallet();
  const history = useCoinHistory();
  const w = wallet.data;

  return (
    <AppShell title="Нур-Коины">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <section className="surface p-5 lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Баланс
                </p>
                {w ? (
                  <p className="mt-1 font-display text-4xl">{w.coins}</p>
                ) : (
                  <Skeleton className="mt-2 h-10 w-24" />
                )}
                <p className="text-sm text-muted-foreground">Нур-Коины</p>
              </div>
              <span className="grid size-14 place-items-center rounded-2xl bg-coin/40 text-3xl">
                🪙
              </span>
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-secondary p-4 text-sm">
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-accent" />
              <p className="min-w-0">
                <span className="block font-medium">
                  Следующее пополнение +{REFILL_AMOUNT}{" "}
                  {w ? formatRefillIn(w.nextRefillAt, new Date()) : "…"}
                </span>
                {w ? (
                  <span className="block text-xs text-muted-foreground">
                    {formatWhen(w.nextRefillAt)}
                  </span>
                ) : null}
              </p>
            </div>
            {w?.subscribed && w.subscriptionEndsAt ? (
              <p className="mt-3 rounded-2xl bg-primary-soft p-4 text-sm">
                💎 Подписка активна до {formatWhen(w.subscriptionEndsAt)}.{" "}
                {w.freeAnalysisAvailable
                  ? "Сегодняшний бесплатный анализ ещё доступен."
                  : "Бесплатный анализ на сегодня уже использован."}
              </p>
            ) : null}
            <Button asChild size="lg" className="mt-4 w-full">
              <Link to="/analysis">
                <Sparkles className="size-4" /> Сделать ИИ-анализ
              </Link>
            </Button>
          </section>

          <section className="surface p-5">
            <h2 className="font-display text-base">Как это работает</h2>
            <ul className="mt-4 space-y-3">
              {rules.map((r) => (
                <li key={r.text} className="flex items-start gap-3 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary">
                    {r.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.text}</span>
                    <span className="block text-xs text-muted-foreground">{r.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className="surface p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base">Пополнить</h2>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                Скоро
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-border p-4">
                <span className="text-2xl">🪙</span>
                <p className="mt-2 font-semibold">{COIN_PACK.coins} коинов</p>
                <p className="text-sm text-muted-foreground">
                  Хватит на {Math.floor(COIN_PACK.coins / ANALYSIS_COST)} анализов
                </p>
                <Button className="mt-4" variant="secondary" disabled>
                  {tenge.format(COIN_PACK.priceKzt)} ₸
                </Button>
              </div>
              <div className="flex flex-col rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
                <span className="text-2xl">💎</span>
                <p className="mt-2 font-semibold">Подписка на месяц</p>
                <p className="text-sm text-muted-foreground">
                  Анализ каждый день бесплатно и НурAI без лимита
                </p>
                <Button className="mt-4" variant="secondary" disabled>
                  {tenge.format(SUBSCRIPTION_PRICE_KZT)} ₸ / мес
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Покупка коинов и подписка появятся в ближайшем обновлении.
            </p>
          </section>

          <section className="surface p-5">
            <h2 className="font-display text-base">История</h2>
            {history.isPending ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
            ) : (history.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Пока операций нет.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {(history.data ?? []).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{coinActionLabel(t.action)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatWhen(t.created_at)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        t.amount >= 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {t.amount >= 0 ? `+${t.amount}` : `−${Math.abs(t.amount)}`} 🪙
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
