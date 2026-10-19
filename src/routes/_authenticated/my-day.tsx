import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MoodLegend } from "@/components/mood/MoodLegend";
import { TagBadges } from "@/components/mood/TagPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCheckins, useCustomTags, useDeleteCheckin } from "@/hooks/useMood";
import { MONTHS_NOM, formatRuDay } from "@/lib/dates";
import {
  averageLevel,
  formatClock,
  groupByDay,
  isoDay,
  moodLevel,
  parseIsoDay,
  type Checkin,
  type CustomTag,
} from "@/lib/mood";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/_authenticated/my-day")({
  validateSearch: (search: Record<string, unknown>): { day?: string | undefined } => ({
    day:
      typeof search["day"] === "string" && ISO_DAY.test(search["day"])
        ? (search["day"] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Мой день — история настроения — Nur Balance" },
      {
        name: "description",
        content:
          "Календарь настроения со смайликами и все отметки за выбранный день: правка и удаление.",
      },
    ],
  }),
  component: MyDayPage,
});

function MyDayPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/my-day" });
  const today = isoDay(new Date());
  const selected = search.day && search.day <= today ? search.day : today;
  const selectedDate = parseIsoDay(selected);
  const [view, setView] = useState({
    year: selectedDate.getFullYear(),
    month: selectedDate.getMonth(),
  });

  const from = isoDay(new Date(view.year, view.month, 1));
  const to = isoDay(new Date(view.year, view.month + 1, 0));
  const month = useCheckins(from, to);
  const tags = useCustomTags();
  const byDay = groupByDay(month.data ?? []);
  const dayRows = [...(byDay.get(selected) ?? [])].reverse();
  const inView = selected >= from && selected <= to;

  const now = new Date();
  const isCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();
  const shiftMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <AppShell title="Мой день">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <section className="surface p-5 lg:p-6">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftMonth(-1)}
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <p className="font-display text-base">
              {MONTHS_NOM[view.month]} {view.year}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftMonth(1)}
              disabled={isCurrentMonth}
              aria-label="Следующий месяц"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
          {month.isPending ? (
            <Skeleton className="mt-4 h-72 rounded-2xl" />
          ) : month.isError ? (
            <div className="mt-4 rounded-2xl bg-secondary/70 p-6 text-center">
              <p className="text-sm">{month.error.message}</p>
              <Button className="mt-3" variant="secondary" onClick={() => void month.refetch()}>
                Повторить
              </Button>
            </div>
          ) : (
            <MonthGrid
              year={view.year}
              month={view.month}
              today={today}
              selected={selected}
              byDay={byDay}
              onSelect={(day) => void navigate({ search: { day }, replace: true })}
            />
          )}
        </section>

        <section className="surface p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base">{formatRuDay(selected)}</h2>
            <Button asChild size="sm">
              <Link to="/mood">
                <Plus className="size-4" /> Отметить
              </Link>
            </Button>
          </div>
          {!inView ? (
            <p className="mt-4 text-sm text-muted-foreground">Выбери день в календаре.</p>
          ) : month.isPending ? (
            <div className="mt-4 space-y-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : dayRows.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-secondary/70 p-6 text-center">
              <span className="text-3xl">🌤️</span>
              <p className="mt-3 font-semibold">За этот день отметок нет</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Отметка занимает 10–15 секунд: настроение, эмоции, активности.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {dayRows.map((c) => (
                <CheckinCard key={c.id} checkin={c} custom={tags.data ?? []} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function MonthGrid({
  year,
  month,
  today,
  selected,
  byDay,
  onSelect,
}: {
  year: number;
  month: number;
  today: string;
  selected: string;
  byDay: Map<string, Checkin[]>;
  onSelect: (day: string) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = [...byDay.values()].reduce((s, l) => s + l.length, 0);
  return (
    <>
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted-foreground">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = isoDay(new Date(year, month, i + 1));
          const rows = byDay.get(day) ?? [];
          const avg = averageLevel(rows);
          const mood = avg === null ? null : moodLevel(avg);
          const future = day > today;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => onSelect(day)}
              title={
                mood
                  ? `${formatRuDay(day)} — ${mood.label}, отметок: ${rows.length}`
                  : formatRuDay(day)
              }
              className={`relative grid aspect-square place-items-center rounded-xl text-sm transition-transform disabled:opacity-40 ${
                mood
                  ? `${mood.soft} hover:scale-105`
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              } ${day === selected ? "ring-2 ring-primary" : day === today ? "ring-1 ring-primary/40" : ""}`}
            >
              {mood ? (
                <>
                  <span className="text-lg leading-none">{mood.emoji}</span>
                  <span className="absolute right-1 bottom-0.5 text-[9px] text-muted-foreground">
                    {i + 1}
                  </span>
                </>
              ) : (
                i + 1
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {total > 0
          ? `Отметок за месяц: ${total}. Цвет дня — среднее настроение за день.`
          : "В этом месяце пока нет отметок."}
      </p>
      <MoodLegend />
    </>
  );
}

function CheckinCard({ checkin, custom }: { checkin: Checkin; custom: readonly CustomTag[] }) {
  const del = useDeleteCheckin();
  const [confirm, setConfirm] = useState(false);
  const mood = moodLevel(checkin.level);
  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-full text-2xl ${mood.bg}`}
        >
          {mood.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {formatClock(checkin.created_at)} · {mood.label}
          </p>
          <div className="mt-2 space-y-1.5">
            <TagBadges kind="emotion" keys={checkin.emotions} custom={custom} max={4} />
            <TagBadges kind="activity" keys={checkin.activities} custom={custom} max={4} />
          </div>
          {checkin.note ? (
            <p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">
              {checkin.note}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Изменить отметку">
            <Link to="/mood" search={{ id: checkin.id }}>
              <Pencil className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Удалить отметку"
            onClick={() => setConfirm(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отметку?</AlertDialogTitle>
            <AlertDialogDescription>
              Отметка за {formatClock(checkin.created_at)} исчезнет из истории и статистики.
              Восстановить её не получится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Оставить</AlertDialogCancel>
            <AlertDialogAction
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault();
                del.mutate(checkin.id, {
                  onSuccess: () => {
                    setConfirm(false);
                    toast.success("Отметка удалена");
                  },
                  onError: (err) => toast.error(err.message),
                });
              }}
            >
              {del.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
