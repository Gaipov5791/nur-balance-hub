import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCheckins } from "@/hooks/useMood";
import { MOOD_LEVELS, formatClock, isoDay, moodLevel } from "@/lib/mood";

/** Home card: one tap on a smiley opens the check-in wizard with that mood preselected. */
export function QuickMoodCard() {
  const today = isoDay(new Date());
  const q = useCheckins(today, today);
  const rows = q.data ?? [];
  const last = rows[rows.length - 1];

  return (
    <section className="surface p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base">Как твоё настроение сейчас?</h2>
        <Link
          to="/my-day"
          className="flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
        >
          Мой день <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {MOOD_LEVELS.map((m) => (
          <Link
            key={m.level}
            to="/mood"
            search={{ level: m.level }}
            className={`flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-transform hover:-translate-y-0.5 ${m.soft}`}
            aria-label={m.label}
          >
            <span className={`grid size-11 place-items-center rounded-full text-2xl ${m.bg}`}>
              {m.emoji}
            </span>
            <span className="text-center text-[10px] leading-tight sm:text-[11px]">{m.label}</span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {last
          ? `Сегодня отметок: ${rows.length}. Последняя в ${formatClock(last.created_at)} — ${moodLevel(last.level).label.toLowerCase()}.`
          : "Сегодня ещё нет отметок. Это займёт 10–15 секунд."}
      </p>
    </section>
  );
}
