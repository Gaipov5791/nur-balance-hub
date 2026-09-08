import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Play } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel, TipPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { careCategories } from "@/data/demo";

export const Route = createFileRoute("/_authenticated/care")({
  head: () => ({
    meta: [
      { title: "Ситуативные советы: тревога, паника, бессонница — Nur Balance" },
      {
        name: "description",
        content:
          "Быстрая помощь при тревоге, панике, бессоннице и выгорании: аудио-практики и пошаговые техники заземления.",
      },
      { property: "og:title", content: "Ситуативные советы — Nur Balance" },
      {
        property: "og:description",
        content: "Дыхательные практики, медитации и пошаговые карточки на трудный момент.",
      },
    ],
  }),
  component: CarePage,
});

function CarePage() {
  const [activeId, setActiveId] = useState(careCategories[0]!.id);
  const active = careCategories.find((c) => c.id === activeId)!;

  return (
    <AppShell
      title="Ситуативные советы"
      aside={
        <>
          <TipPanel />
          <CoinsPanel />
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {careCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveId(c.id)}
            className={`surface p-4 text-left transition-shadow hover:shadow-lift ${
              activeId === c.id ? "ring-2 ring-primary" : ""
            }`}
          >
            <span className="text-2xl">{c.emoji}</span>
            <p className="mt-2 font-semibold">{c.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.summary}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="surface p-5 lg:p-6">
          <h2 className="font-display text-base">
            {active.emoji} {active.title}: пошаговая техника
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{active.intro}</p>
          <ol className="mt-4 space-y-3">
            {active.steps.map((s, i) => (
              <li key={s} className="flex gap-3 rounded-2xl bg-secondary/70 p-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-2xl bg-primary-soft p-4 text-sm">
            <p className="font-semibold">Почему это работает</p>
            <p className="mt-1">{active.why}</p>
          </div>
          {active.important ? (
            <div className="mt-3 rounded-2xl border border-border p-4 text-sm">
              <p className="font-semibold">Важно</p>
              <p className="mt-1">{active.important}</p>
            </div>
          ) : null}
          <Button
            className="mt-5"
            onClick={() => toast.success("Упражнение выполнено. +5 Nur-Coins")}
          >
            <CheckCircle2 className="size-4" /> Я выполнила упражнение
          </Button>
        </section>


        <section className="surface p-5">
          <h2 className="font-display text-base">Аудио-практики</h2>
          <ul className="mt-4 space-y-3">
            {active.audio.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl border border-border p-3"
              >
                <Button size="icon" aria-label={`Слушать: ${a.title}`}>
                  <Play className="size-4" />
                </Button>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{a.title}</span>
                  <span className="mt-2 block h-1.5 rounded-full bg-secondary">
                    <span className="block h-1.5 w-1/4 rounded-full bg-primary" />
                  </span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{a.duration}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-2xl bg-accent/15 p-4 text-sm">
            Если состояние острое и вам небезопасно — обратитесь за срочной помощью к специалисту
            или в кризисную службу.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
