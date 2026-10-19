import { Link } from "@tanstack/react-router";
import { CalendarClock, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lifeStatuses, moods, type MoodKey } from "@/data/demo";
import { useProfile } from "@/hooks/useAuth";
import { useCoinWallet } from "@/hooks/useCoins";
import { calendarMonth } from "@/lib/dates";
import { ANALYSIS_COST, REFILL_AMOUNT, REFILL_INTERVAL_DAYS, formatRefillIn } from "@/lib/economy";
import { LEGACY_MOOD_LEVEL, moodLevel } from "@/lib/mood";

export function CoinsPanel() {
  const { profile } = useProfile();
  const wallet = useCoinWallet();
  const coins = wallet.data?.coins ?? profile?.coins ?? 0;
  const free = wallet.data?.freeAnalysisAvailable ?? false;
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Баланс
          </p>
          <p className="mt-1 font-display text-3xl">{coins}</p>
          <p className="text-sm text-muted-foreground">Нур-Коины</p>
        </div>
        <span className="grid size-12 place-items-center rounded-2xl bg-coin/40 text-2xl">🪙</span>
      </div>
      <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-secondary p-4 text-sm">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-accent" />
        <p className="min-w-0">
          <span className="block font-medium">
            +{REFILL_AMOUNT}{" "}
            {wallet.data ? formatRefillIn(wallet.data.nextRefillAt, new Date()) : "скоро"}
          </span>
          <span className="block text-xs text-muted-foreground">
            Коины пополняются сами каждые {REFILL_INTERVAL_DAYS} дня
          </span>
        </p>
      </div>
      <Button asChild className="mt-4 w-full">
        <Link to="/analysis">
          <Sparkles className="size-4" /> ИИ-анализ · {free ? "бесплатно" : `${ANALYSIS_COST} 🪙`}
        </Link>
      </Button>
      <Button asChild variant="secondary" className="mt-2 w-full">
        <Link to="/coins">Подробнее о Нур-Коинах</Link>
      </Button>
    </div>
  );
}

export function BuddyPanel() {
  const { profile: real } = useProfile();
  const status = lifeStatuses.find((s) => s.id === real?.life_status);
  return (
    <div className="surface p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Users className="size-4 text-primary" /> Круг поддержки
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {status
          ? `Твоя категория: ${status.emoji} ${status.label}`
          : "Укажи жизненный статус в настройках — так проще найти собеседника с похожим опытом."}
      </p>
      <Button asChild className="mt-4 w-full">
        <Link to="/buddy">Найти собеседника</Link>
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
        Сделай выдох длиннее вдоха — 4 счёта вдох, 8 выдох. Три минуты, и тело успокаивается.
      </p>
      <Button asChild variant="secondary" className="mt-4 w-full">
        <Link to="/care">Открыть практики</Link>
      </Button>
    </div>
  );
}

type CalendarEntry = { day: number; mood: MoodKey; date: string };

export function MoodCalendar({
  compact = false,
  entries = [],
  monthLabel,
  today,
  year,
  month,
  onSelectDay,
}: {
  compact?: boolean;
  entries?: CalendarEntry[];
  monthLabel?: string;
  today?: number;
  year?: number;
  /** 0-based month */
  month?: number;
  /** Called with the ISO date and whether that day has an entry. */
  onSelectDay?: (isoDate: string, hasEntry: boolean) => void;
}) {
  const fallback = calendarMonth();
  const resolvedYear = year ?? fallback.year;
  const resolvedMonth = month ?? fallback.month;
  const resolvedToday = today ?? fallback.today;
  const resolvedLabel = monthLabel ?? fallback.monthLabel;
  const byDay = new Map(entries.map((e) => [e.day, e]));
  const daysInMonth = new Date(resolvedYear, resolvedMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const offset = (new Date(resolvedYear, resolvedMonth, 1).getDay() + 6) % 7;
  const isoFor = (day: number) =>
    `${resolvedYear}-${String(resolvedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div className={compact ? "surface p-5" : "surface p-5 lg:p-6"}>
      <div className="flex items-center justify-between">
        <p className="font-display text-base">{resolvedLabel}</p>
        <span className="text-xs text-muted-foreground">{entries.length} записей</span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted-foreground">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const entry = byDay.get(day);
          const mood = entry ? moods[entry.mood] : null;
          const className = `grid aspect-square place-items-center rounded-xl text-sm ${
            entry ? moodLevel(LEGACY_MOOD_LEVEL[entry.mood]).soft : "bg-secondary/60 text-muted-foreground"
          } ${day === resolvedToday ? "ring-2 ring-primary" : ""} ${
            onSelectDay
              ? mood
                ? "cursor-pointer transition-transform hover:scale-105"
                : "cursor-pointer opacity-60 transition-opacity hover:opacity-100"
              : ""
          }`;
          const title = entry ? `${entry.date} — ${moods[entry.mood].label}` : String(day);
          const content = mood ? <span className="text-base">{mood.emoji}</span> : day;

          if (!onSelectDay) {
            return (
              <div key={day} className={className} title={title}>
                {content}
              </div>
            );
          }
          return (
            <button
              key={day}
              type="button"
              className={className}
              title={entry ? title : `${day} — записи нет`}
              onClick={() => onSelectDay(isoFor(day), !!entry)}
            >
              {content}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.entries(moods) as [MoodKey, (typeof moods)[MoodKey]][]).map(([key, m]) => (
          <span
            key={key}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] leading-tight text-foreground ${
              moodLevel(LEGACY_MOOD_LEVEL[key]).soft
            }`}
          >
            {m.emoji} {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
