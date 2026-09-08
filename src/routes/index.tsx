import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Video } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BuddyPanel, CoinsPanel, MoodCalendar, TipPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { careCategories, journalEntries, moods, profile } from "@/data/demo";
import { useProfile } from "@/hooks/useAuth";


export const Route = createFileRoute("/")({
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
  const recent = journalEntries.slice(-3).reverse();
  const { profile: real, user } = useProfile();
  const name = real?.name || user?.email?.split("@")[0] || profile.name;
  const coins = user ? (real?.coins ?? 0) : profile.coins;
  const streak = user ? (real?.streak ?? 0) : profile.streak;
  const today = new Date();
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(today);
  const hour = today.getHours();
  const greeting =
    hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

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
            <Stat value={`${journalEntries.length}`} label="записей" />
          </div>
        </div>
      </section>


      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <MoodCalendar />
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
          <ul className="mt-4 space-y-3">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-card text-xl">
                  {moods[e.mood].emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{e.date}</span>
                    <span className="text-xs text-muted-foreground">{e.duration}</span>
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">{e.note}</span>
                </span>
              </li>
            ))}
          </ul>
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
