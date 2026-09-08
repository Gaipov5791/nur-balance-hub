import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BuddyPanel, CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  coinRules,
  dailyCoinLimit,
  profile,
  serviceRewards,
  streakMilestones,
  symbolicRewards,
} from "@/data/demo";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Достижения и Nur-Coins — Nur Balance" },
      {
        name: "description",
        content:
          "Баланс Nur-Coins, прогресс серии дней и каталог наград: бейджи, оформление и бонусы на консультации психолога.",
      },
      { property: "og:title", content: "Достижения и баланс — Nur Balance" },
      {
        property: "og:description",
        content: "Монеты за заботу о себе, бонусы за серии 3, 7, 14 и 30 дней.",
      },
    ],
  }),
  component: RewardsPage,
});

type Reward = { id: string; title: string; desc: string; cost: number; emoji: string };

function RewardCard({ r }: { r: Reward }) {
  const free = r.cost === 0;
  return (
    <div className="rounded-2xl border border-border p-4">
      <span className="text-2xl">{r.emoji}</span>
      <p className="mt-2 font-semibold">{r.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
      <Button
        className="mt-3 w-full"
        variant={free || profile.coins >= r.cost ? "default" : "secondary"}
        disabled={!free && profile.coins < r.cost}
        onClick={() =>
          toast.success(free ? `«${r.title}» уже доступно` : `«${r.title}» активировано`)
        }
      >
        {free ? "Открывается автоматически" : `🪙 ${r.cost}`}
      </Button>
    </div>
  );
}

export function RewardsPage() {
  return (
    <AppShell title="Достижения и баланс" aside={<BuddyPanel />}>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <CoinsPanel />
          <section className="surface p-5">
            <h2 className="font-display text-base">Как начисляются монеты</h2>
            <ul className="mt-4 space-y-3">
              {coinRules.map((r) => (
                <li key={r.text} className="flex items-start gap-3 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary">
                    {r.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{r.text}</span>
                    <span className="block text-xs text-muted-foreground">{r.note}</span>
                  </span>
                  <span className="font-semibold text-primary">{r.value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
              За обычную активность можно получить не больше {dailyCoinLimit} монет в день. Монеты —
              это мягкое поощрение за заботу о себе, а не гонка.
            </p>
          </section>
        </div>

        <div className="space-y-5">
          <section className="surface p-5">
            <h2 className="font-display text-base">Серия дней</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Текущая серия — {profile.streak} дней подряд
            </p>
            <div className="mt-4 space-y-4">
              {streakMilestones.map((m) => (
                <div key={m.days}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      {m.days} дней
                      {m.badge ? (
                        <span className="text-muted-foreground"> · бейдж «{m.badge}»</span>
                      ) : null}
                    </span>
                    <span
                      className={
                        profile.streak >= m.days ? "text-primary" : "text-muted-foreground"
                      }
                    >
                      {profile.streak >= m.days ? `получено +${m.bonus} 🪙` : `${profile.streak}/${m.days} · +${m.bonus} 🪙`}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, (profile.streak / m.days) * 100)}
                    className="mt-2 h-2"
                  />
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-2xl bg-primary-soft p-4 text-sm">
              Пропустили день? Ничего страшного — раз в неделю серия просто замирает и продолжается
              дальше. Никаких штрафов и потерянных монет.
            </p>
          </section>

          <section className="surface p-5">
            <h2 className="font-display text-base">Награды за заботу о себе</h2>
            <p className="mt-3 text-sm font-semibold">Символические</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {symbolicRewards.map((r) => (
                <RewardCard key={r.id} r={r} />
              ))}
            </div>

            <p className="mt-5 text-sm font-semibold">Бонусы на консультации</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {serviceRewards.map((r) => (
                <RewardCard key={r.id} r={r} />
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Стоимость бонусов на консультации предварительная — уточняется вместе с психологами.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

