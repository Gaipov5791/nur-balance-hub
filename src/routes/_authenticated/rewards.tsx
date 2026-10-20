import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BuddyPanel, CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import {
  ANALYSIS_COST,
  COIN_PACK,
  COIN_REFILL_AMOUNT,
  COIN_REFILL_DAYS,
  SUBSCRIPTION,
} from "@/lib/wallet";
import { useWallet } from "@/hooks/useWallet";

export const Route = createFileRoute("/_authenticated/rewards")({
  head: () => ({
    meta: [
      { title: "Nur-Coins и подписка — Nur Balance" },
      {
        name: "description",
        content: "Баланс Nur-Coins: +15 монет каждые 3 дня, ИИ-анализ настроения за 15 монет, пакеты монет и подписка.",
      },
      { property: "og:title", content: "Nur-Coins — Nur Balance" },
      { property: "og:description", content: "Монеты пополняются сами каждые 3 дня и тратятся на ИИ-анализ настроения." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RewardsPage,
});

const fmtKzt = (n: number) => `${n.toLocaleString("ru-RU")} ₸`;

export function RewardsPage() {
  const wallet = useWallet();
  const sub = wallet.data?.subscriptionActive;
  return (
    <AppShell title="Nur-Coins" aside={<BuddyPanel />}>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <CoinsPanel />
          <section className="surface p-5">
            <h2 className="font-display text-base">Как это работает</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary">⏳</span>
                <span className="min-w-0 flex-1">
                  <span className="block">Пополнение баланса</span>
                  <span className="block text-xs text-muted-foreground">
                    Каждые {COIN_REFILL_DAYS} дня, автоматически и без ограничений
                  </span>
                </span>
                <span className="font-semibold text-primary">+{COIN_REFILL_AMOUNT}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary">✨</span>
                <span className="min-w-0 flex-1">
                  <span className="block">ИИ-анализ настроения</span>
                  <span className="block text-xs text-muted-foreground">За неделю или месяц, минимум 3 записи</span>
                </span>
                <span className="font-semibold text-accent">−{ANALYSIS_COST}</span>
              </li>
            </ul>
            <Button asChild className="mt-4 w-full">
              <Link to="/analysis">
                <Sparkles className="size-4" /> Перейти к анализу
              </Link>
            </Button>
          </section>
        </div>

        <div className="space-y-5">
          <section className="surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-display text-base">
                  <Crown className="size-4 text-accent" /> Подписка Nur Balance
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{fmtKzt(SUBSCRIPTION.priceKzt)} в месяц</p>
              </div>
              {sub ? (
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">Активна</span>
              ) : null}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>💬 Безлимитные разговоры с НурAI</li>
              <li>✨ Один ИИ-анализ настроения каждый день — без монет</li>
              <li>🪙 Пополнение +{COIN_REFILL_AMOUNT} каждые {COIN_REFILL_DAYS} дня сохраняется</li>
            </ul>
            <Button className="mt-4 w-full" variant="secondary" disabled>
              Оформление подписки — скоро
            </Button>
          </section>

          <section className="surface p-5">
            <h2 className="font-display text-base">Пакет монет</h2>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
              <span className="min-w-0">
                <span className="block font-display text-xl">🪙 {COIN_PACK.coins}</span>
                <span className="block text-xs text-muted-foreground">
                  ≈ {Math.floor(COIN_PACK.coins / ANALYSIS_COST)} анализов
                </span>
              </span>
              <span className="font-semibold">{fmtKzt(COIN_PACK.priceKzt)}</span>
            </div>
            <Button className="mt-4 w-full" variant="secondary" disabled>
              Покупка — скоро
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Оплата появится после подключения Kaspi Pay. Монеты, накопленные раньше, остаются на балансе.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
