import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Video } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BuddyPanel, CoinsPanel, MoodCalendar, TipPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { careCategories, moods } from "@/data/demo";
import { useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calendarMonth, formatRuDay } from "@/lib/dates";
import { listJournalEntries } from "@/lib/journal.functions";
import { formatTime } from "@/components/VideoRecorder";
import { browserTimeZone, localDateInZone } from "@/lib/reminders";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
  },
  head: () => ({
    meta: [
      { title: "Nur Balance — видео-дневник эмоций и взаимоподдержка" },
      {
        name: "description",
        content:
          "Nur Balance: видео-дневник эмоций, календарь настроений, Nur-Coins за заботу о себе и поддержка от собеседницы с похожим опытом.",
      },
      { property: "og:title", content: "Nur Balance — забота о ментальном здоровье" },
      {
        property: "og:description",
        content: "Видео-дневник, серия дней, Nur-Coins и поддержка от подруги по ситуации.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile: real, user } = useProfile();
  const listFn = useServerFn(listJournalEntries);
  const entriesQuery = useQuery({
    queryKey: ["journal", "list"],
    queryFn: () => listFn(),
    retry: 2,
  });
  const entries = entriesQuery.data ?? [];
  const recent = [...entries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const name = real?.name || user?.email?.split("@")[0] || "Вы";
  const navigate = useNavigate();
  const coins = real?.coins ?? 0;
  const streak = real?.streak ?? 0;
  const today = new Date();
  const month = calendarMonth(today);
  const calendarEntries = entries
    .filter((e) => {
      const [y, m] = e.entryDate.split("-").map(Number);
      return y === month.year && m === month.month + 1;
    })
    .map((e) => ({
      day: Number(e.entryDate.slice(8, 10)),
      mood: e.mood,
      date: formatRuDay(e.entryDate),
    }));
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(today);
  const hour = today.getHours();
  const greeting =
    hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  const localToday = localDateInZone(today, browserTimeZone());
  const needsTodayEntry = !entriesQuery.isPending && !!real && real.last_entry_date !== localToday;

  return (
    <AppShell
      aside={
        <>
          <CoinsPanel />
          <BuddyPanel />
          <TipPanel />
        </>
      }
    >
      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center lg:p-8">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground first-letter:uppercase">{dateLabel}</p>
            <h1 className="mt-1 text-2xl md:text-3xl">
              {greeting}, {name}
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              {streak > 0
                ? `Вы держите серию ${streak} дней. Запишите короткое видео о том, как прошёл день — это займёт три минуты.`
                : "Запишите короткое видео о том, как прошёл день — это займёт три минуты."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/journal">
                  <Video className="size-4" /> Записать дневник
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link to="/care">Мне сейчас тяжело</Link>
              </Button>
            </div>
          </div>
          <div className="grid w-full shrink-0 grid-cols-3 gap-3 md:w-72">
            <Stat value={`${streak}`} label="дней подряд" />
            <Stat value={`${coins}`} label="Nur-Coins" />
            <Stat
              value={entriesQuery.isPending ? "…" : `${entries.length}`}
              label="записей"
            />
          </div>
        </div>
      </section>

      {needsTodayEntry ? (
        <section className="surface mt-5 p-5 md:p-6">
          <p className="font-display text-base">Как прошёл день?</p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Можно записать короткое видео — когда будет удобно. Напоминание приходит письмом в выбранное
            время, если за сегодня ещё нет записи.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/journal">
                <Video className="size-4" /> Записать видео
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/settings">Время напоминания</Link>
            </Button>
          </div>
        </section>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <MoodCalendar
          entries={calendarEntries}
          monthLabel={month.monthLabel}
          today={month.today}
          year={month.year}
          month={month.month}
          onSelectDay={(_iso, hasEntry) => navigate({ to: hasEntry ? "/archive" : "/journal" })}
        />
        <div className="surface p-5 lg:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base">Последние записи</h2>
            <Link
              to="/archive"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Весь архив <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {entriesQuery.isPending ? (
            <p className="mt-4 text-sm text-muted-foreground">Загружаем записи…</p>
          ) : recent.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Здесь появятся ваши видео-записи. Первая займёт около трёх минут.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-card text-xl">
                    {moods[e.mood].emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{formatRuDay(e.entryDate)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(e.durationSeconds)}
                      </span>
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {e.note || moods[e.mood].label}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:hidden">
        <CoinsPanel />
        <BuddyPanel />
      </div>

      <section className="mt-5">
        <h2 className="mb-3 font-display text-base">Ситуативные советы</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {careCategories.map((c) => (
            <Link
              key={c.id}
              to="/care"
              className="surface p-4 transition-shadow hover:shadow-lift"
            >
              <span className="text-2xl">{c.emoji}</span>
              <p className="mt-2 font-semibold">{c.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-3 text-center">
      <p className="font-display text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
