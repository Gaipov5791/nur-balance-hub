import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Play } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel, MoodCalendar } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { journalEntries, moods } from "@/data/demo";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Календарь настроений и архив записей — Nur Balance" },
      {
        name: "description",
        content:
          "Календарная сетка с иконками настроения и закрытый архив ваших видео-записей под PIN-кодом.",
      },
      { property: "og:title", content: "Календарь настроений — Nur Balance" },
      {
        property: "og:description",
        content: "Смотрите динамику состояния по дням и пересматривайте свои записи.",
      },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <AppShell title="Календарь и архив" aside={<CoinsPanel />}>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <MoodCalendar />

        <section className="surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base">Личный архив</h2>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> под PIN-кодом
            </span>
          </div>

          {!unlocked ? (
            <div className="mt-6 rounded-2xl bg-secondary/70 p-6 text-center">
              <span className="text-3xl">🔒</span>
              <p className="mt-3 font-semibold">Архив защищён</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Введите PIN-код, чтобы посмотреть свои записи.
              </p>
              <Button className="mt-4" onClick={() => setUnlocked(true)}>
                Разблокировать
              </Button>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {[...journalEntries].reverse().map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-2xl border border-border p-3"
                >
                  <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
                    {moods[e.mood].emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {e.date} · {moods[e.mood].label} {e.level}/5
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{e.note}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{e.duration}</span>
                  <Button size="icon" variant="secondary" aria-label="Смотреть запись">
                    <Play className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
