import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { MoodCheckinForm } from "@/components/mood/MoodCheckinForm";
import { MoodDay } from "@/components/mood/MoodDay";
import { MoodStats } from "@/components/mood/MoodStats";
import { useMoodCheckins } from "@/hooks/useMood";

const TABS = [
  { id: "new", label: "Отметить" },
  { id: "day", label: "Мой день" },
  { id: "stats", label: "Статистика" },
] as const;

export const Route = createFileRoute("/_authenticated/mood")({
  validateSearch: z.object({ tab: z.enum(["new", "day", "stats"]).optional() }),
  head: () => ({
    meta: [
      { title: "Настроение, эмоции и активности — Nur Balance" },
      { name: "description", content: "Отмечай настроение цветными смайликами, эмоции и активности, смотри историю и статистику за неделю или месяц." },
      { property: "og:title", content: "Трекер настроения — Nur Balance" },
      { property: "og:description", content: "Быстрая отметка настроения, календарь «Мой день» и графики статистики." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MoodPage,
});

function MoodPage() {
  const { tab = "new" } = Route.useSearch();
  const navigate = useNavigate({ from: "/mood" });
  const q = useMoodCheckins();
  const checkins = q.data ?? [];

  return (
    <AppShell title="Настроение">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex gap-2 overflow-x-auto rounded-full bg-secondary p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate({ search: { tab: t.id } })}
              className={`flex-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "new" ? (
          <MoodCheckinForm onDone={() => navigate({ search: { tab: "stats" } })} />
        ) : q.isPending ? (
          <p className="text-sm text-muted-foreground">Загружаем отметки…</p>
        ) : q.isError ? (
          <div className="surface flex flex-wrap items-center gap-3 p-5 text-sm">
            Не удалось загрузить отметки.
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              Повторить
            </Button>
          </div>
        ) : tab === "day" ? (
          <MoodDay checkins={checkins} />
        ) : (
          <MoodStats checkins={checkins} />
        )}
        <p className="pb-2 text-center text-xs text-muted-foreground">
          Отметки видишь только ты. Цвета и смайлики — не диагноз, а способ заметить, как меняется настроение.
        </p>
      </div>
    </AppShell>
  );
}
