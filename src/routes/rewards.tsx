import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BuddyPanel, CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { profile, rewards } from "@/data/demo";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Достижения и Nur-Coins — Nur Balance" },
      {
        name: "description",
        content:
          "Баланс Nur-Coins, прогресс серии дней и каталог наград: заморозка серии, аудио-практики и темы оформления.",
      },
      { property: "og:title", content: "Достижения и баланс — Nur Balance" },
      {
        property: "og:description",
        content: "Монеты за заботу о себе, бонусы за серии 7, 14 и 30 дней.",
      },
    ],
  }),
  component: RewardsPage,
});

const earnRules = [
  { emoji: "🎥", text: "Запись видео-дневника", value: "+10" },
  { emoji: "🧘", text: "Упражнение из «Ситуативных советов»", value: "+5" },
  { emoji: "💬", text: "Сообщение поддержки бадди", value: "+15" },
  { emoji: "🔥", text: "Бонус за серию 7 / 14 / 30 дней", value: "+50" },
];

const milestones = [7, 14, 30];

export function RewardsPage() {
  return (
    <AppShell title="Достижения и баланс" aside={<BuddyPanel />}>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <CoinsPanel />
          <section className="surface p-5">
            <h2 className="font-display text-base">Как начисляются монеты</h2>
            <ul className="mt-4 space-y-3">
              {earnRules.map((r) => (
                <li key={r.text} className="flex items-center gap-3 text-sm">
                  <span className="grid size-9 place-items-center rounded-xl bg-secondary">
                    {r.emoji}
                  </span>
                  <span className="flex-1">{r.text}</span>
                  <span className="font-semibold text-primary">{r.value}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className="surface p-5">
            <h2 className="font-display text-base">Серия дней</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Текущая серия — {profile.streak} дней подряд
            </p>
            <div className="mt-4 space-y-4">
              {milestones.map((m) => (
                <div key={m}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{m} дней</span>
                    <span
                      className={
                        profile.streak >= m ? "text-primary" : "text-muted-foreground"
                      }
                    >
                      {profile.streak >= m ? "получено" : `${profile.streak}/${m}`}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, (profile.streak / m) * 100)}
                    className="mt-2 h-2"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="font-display text-base">Каталог наград</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rewards.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border p-4">
                  <span className="text-2xl">{r.emoji}</span>
                  <p className="mt-2 font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                  <Button
                    className="mt-3 w-full"
                    variant={profile.coins >= r.cost ? "default" : "secondary"}
                    disabled={profile.coins < r.cost}
                    onClick={() => toast.success(`«${r.title}» активировано`)}
                  >
                    🪙 {r.cost}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
