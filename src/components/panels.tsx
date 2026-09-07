import { Link } from "@tanstack/react-router";
import { Flame, Sparkles, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { journalEntries, lifeStatuses, moods, profile } from "@/data/demo";

export function CoinsPanel() {
  const next = profile.streak < 14 ? 14 : 30;
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Баланс
          </p>
          <p className="mt-1 font-display text-3xl">{profile.coins}</p>
          <p className="text-sm text-muted-foreground">Nur-Coins</p>
        </div>
        <span className="grid size-12 place-items-center rounded-2xl bg-coin/40 text-2xl">🪙</span>
      </div>
      <div className="mt-5 rounded-2xl bg-secondary p-4">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-1.5">
            <Flame className="size-4 text-accent" /> Серия {profile.streak} дней
          </span>
          <span className="text-muted-foreground">до {next}</span>
        </div>
        <Progress value={(profile.streak / next) * 100} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          Ещё {next - profile.streak} дн. — и бонус за непрерывность
        </p>
      </div>
      <Button asChild variant="secondary" className="mt-4 w-full">
        <Link to="/rewards">Каталог наград</Link>
      </Button>
    </div>
  );
}

export function BuddyPanel() {
  const status = lifeStatuses.find((s) => s.id === profile.status);
  return (
    <div className="surface p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Users className="size-4 text-primary" /> Поддержи подругу
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Ваша категория: {status?.emoji} {status?.label}
      </p>
      <div className="mt-4 flex -space-x-2">
        {["А", "Д", "М", "К"].map((l) => (
          <span
            key={l}
            className="grid size-9 place-items-center rounded-full border-2 border-card bg-primary-soft text-sm font-semibold"
          >
            {l}
          </span>
        ))}
        <span className="grid size-9 place-items-center rounded-full border-2 border-card bg-secondary text-xs font-semibold">
          +7
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">11 участниц сейчас онлайн</p>
      <Button asChild className="mt-4 w-full">
        <Link to="/buddy">Найти собеседницу</Link>
      </Button>
    </div>
  );
}

export function TipPanel() {
  return (
    <div className="surface bg-primary p-5 text-primary-foreground">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4" /> Совет дня
      </p>
      <p className="mt-2 text-sm opacity-90">
        Сделайте выдох длиннее вдоха — 4 счёта вдох, 8 выдох. Три минуты, и тело успокаивается.
      </p>
      <Button asChild variant="secondary" className="mt-4 w-full">
        <Link to="/care">Открыть практики</Link>
      </Button>
    </div>
  );
}

export function MoodCalendar({ compact = false }: { compact?: boolean }) {
  const byDay = new Map(journalEntries.map((e) => [e.day, e]));
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const today = 7;

  return (
    <div className={compact ? "surface p-5" : "surface p-5 lg:p-6"}>
      <div className="flex items-center justify-between">
        <p className="font-display text-base">Сентябрь 2026</p>
        <span className="text-xs text-muted-foreground">
          {journalEntries.length} записей
        </span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted-foreground">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const entry = byDay.get(day);
          const mood = entry ? moods[entry.mood] : null;
          return (
            <div
              key={day}
              className={`grid aspect-square place-items-center rounded-xl text-sm ${
                mood ? mood.tint : "bg-secondary/60 text-muted-foreground"
              } ${day === today ? "ring-2 ring-primary" : ""}`}
              title={entry ? `${entry.date} — ${moods[entry.mood].label}` : `${day} сентября`}
            >
              {mood ? <span className="text-base">{mood.emoji}</span> : day}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(moods).map(([key, m]) => (
          <span
            key={key}
            className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground"
          >
            {m.emoji} {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
