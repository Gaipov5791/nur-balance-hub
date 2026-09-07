import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Circle, Pause, RotateCcw, Save, Square } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel, TipPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { moodKeys, moods } from "@/data/demo";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Видео-дневник эмоций — Nur Balance" },
      {
        name: "description",
        content:
          "Запишите короткое видео о своём дне, отметьте эмоцию по шкале от 1 до 5 и получите +10 Nur-Coins.",
      },
      { property: "og:title", content: "Видео-дневник эмоций — Nur Balance" },
      {
        property: "og:description",
        content: "Запись до 3 минут, метка настроения и продолжение вашей серии дней.",
      },
    ],
  }),
  component: JournalPage,
});

function JournalPage() {
  const [state, setState] = useState<"idle" | "recording" | "paused" | "done">("idle");
  const [mood, setMood] = useState<string | null>(null);
  const [level, setLevel] = useState(3);

  return (
    <AppShell
      title="Видео-дневник"
      aside={
        <>
          <CoinsPanel />
          <TipPanel />
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface overflow-hidden">
          <div className="relative aspect-[4/3] bg-foreground/90">
            <div className="absolute inset-0 grid place-items-center text-center text-background/80">
              <div>
                <p className="font-display text-lg">Превью камеры</p>
                <p className="mt-1 text-sm opacity-70">
                  В прототипе камера не включается — это макет экрана записи
                </p>
              </div>
            </div>
            <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold">
              <span
                className={`size-2 rounded-full ${
                  state === "recording" ? "animate-pulse bg-destructive" : "bg-muted-foreground"
                }`}
              />
              {state === "recording"
                ? "Идёт запись"
                : state === "paused"
                  ? "Пауза"
                  : state === "done"
                    ? "Запись готова"
                    : "Готово к записи"}
            </span>
            <span className="absolute right-4 top-4 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold tabular-nums">
              {state === "idle" ? "00:00" : state === "done" ? "02:18" : "01:07"} / 03:00
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 p-5">
            {state !== "recording" ? (
              <Button size="lg" onClick={() => setState("recording")} className="gap-2">
                <Circle className="size-4 fill-current" />
                {state === "idle" ? "Начать запись" : "Продолжить"}
              </Button>
            ) : (
              <>
                <Button size="lg" variant="secondary" onClick={() => setState("paused")}>
                  <Pause className="size-4" /> Пауза
                </Button>
                <Button size="lg" onClick={() => setState("done")}>
                  <Square className="size-4 fill-current" /> Остановить
                </Button>
              </>
            )}
            <Button
              size="lg"
              variant="ghost"
              onClick={() => {
                setState("idle");
                setMood(null);
              }}
            >
              <RotateCcw className="size-4" /> Перезаписать
            </Button>
          </div>
        </section>

        <section className="surface p-5">
          <h2 className="font-display text-base">Как вы себя чувствуете?</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {moodKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMood(key)}
                className={`flex items-center gap-2 rounded-2xl border p-3 text-left text-sm transition-colors ${
                  mood === key
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-secondary/50 hover:bg-secondary"
                }`}
              >
                <span className="text-xl">{moods[key].emoji}</span>
                {moods[key].label}
              </button>
            ))}
          </div>

          <p className="mt-5 text-sm font-medium">Интенсивность состояния</p>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLevel(n)}
                className={`h-11 flex-1 rounded-xl text-sm font-semibold transition-colors ${
                  level === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-primary-soft"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <Textarea
            className="mt-5 min-h-24"
            placeholder="Короткая заметка к записи (необязательно)"
          />

          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={!mood}
            onClick={() => toast.success("Запись сохранена. +10 Nur-Coins")}
          >
            <Save className="size-4" /> Сохранить запись
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Записи видны только вам.{" "}
            <Link to="/settings" className="text-primary hover:underline">
              Поставить PIN на архив
            </Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
