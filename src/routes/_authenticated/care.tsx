import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, Phone } from "lucide-react";
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
          "Быстрая помощь при тревоге, панике, бессоннице и выгорании: пошаговые техники заземления.",
      },
      { property: "og:title", content: "Ситуативные советы — Nur Balance" },
      {
        property: "og:description",
        content: "Пошаговые карточки на трудный момент: дыхание, заземление, ритуал сна.",
      },
    ],
  }),
  component: CarePage,
});

function CarePage() {
  const [activeId, setActiveId] = useState(careCategories[0]!.id);
  const active = careCategories.find((c) => c.id === activeId)!;
  const [saving, setSaving] = useState(false);

  const completePractice = async () => {
    setSaving(true);
    toast.success("Упражнение выполнено. Береги себя 🌿");
    setSaving(false);
  };


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
      <section className="surface mb-5 border-2 border-accent/40 p-5">
        <h2 className="font-display text-base">Если тебе сейчас небезопасно — позвони</h2>
        <p className="mt-1 text-sm text-muted-foreground">Бесплатно и круглосуточно по Казахстану</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { n: "150", t: "Телефон доверия" },
            { n: "112", t: "Экстренная служба" },
            { n: "103", t: "Скорая помощь" },
            { n: "111", t: "Защита детей и семьи" },
          ].map((p) => (
            <a
              key={p.n}
              href={`tel:${p.n}`}
              className="flex items-center gap-3 rounded-2xl bg-accent/15 p-4 transition-colors hover:bg-accent/25"
            >
              <Phone className="size-5 shrink-0 text-accent" />
              <span>
                <span className="block font-display text-2xl leading-none">{p.n}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{p.t}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

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
          <Button className="mt-5" disabled={saving} onClick={() => void completePractice()}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}{" "}
            Упражнение выполнено
          </Button>
        </section>


        <section className="surface p-5">
          <h2 className="font-display text-base">Если нужна живая поддержка</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Эти техники — самопомощь на короткий момент, а не замена специалисту.
          </p>
          <Button asChild variant="secondary" className="mt-4 w-full">
            <Link to="/therapists">Подобрать психолога</Link>
          </Button>
          <p className="mt-4 rounded-2xl bg-accent/15 p-4 text-sm">
            Если состояние острое и тебе небезопасно — обратись за срочной помощью к специалисту
            или в кризисную службу.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
