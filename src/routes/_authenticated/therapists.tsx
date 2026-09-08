import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { therapists } from "@/data/demo";

export const Route = createFileRoute("/_authenticated/therapists")({
  head: () => ({
    meta: [
      { title: "Психологи: каталог и запись на сессию — Nur Balance" },
      {
        name: "description",
        content:
          "Верифицированные психологи: специализация, опыт, стоимость консультации, чат для вопросов и заявка на сессию.",
      },
      { property: "og:title", content: "Психологи — Nur Balance" },
      {
        property: "og:description",
        content: "Выберите специалиста, задайте вопрос в чате и запишитесь на консультацию.",
      },
    ],
  }),
  component: TherapistsPage,
});

function TherapistsPage() {
  const [selected, setSelected] = useState(therapists[0]!.id);
  const person = therapists.find((t) => t.id === selected)!;

  return (
    <AppShell title="Психологи" aside={<CoinsPanel />}>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-3">
          {therapists.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={`surface flex w-full items-center gap-4 p-4 text-left transition-shadow hover:shadow-lift ${
                selected === t.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary-soft font-display text-lg">
                {t.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold">
                  {t.name}
                  <BadgeCheck className="size-4 text-primary" />
                </span>
                <span className="block text-sm text-muted-foreground">{t.spec}</span>
                <span className="block text-xs text-muted-foreground">{t.exp}</span>
              </span>
              <span className="hidden shrink-0 text-sm font-semibold sm:block">{t.price}</span>
            </button>
          ))}
        </section>

        <section className="surface p-5">
          <h2 className="font-display text-base">Записаться к {person.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {person.spec} · {person.price}
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Заявка отправлена — специалист свяжется с вами");
            }}
          >
            <Input placeholder="Ваше имя" defaultValue="Айпери" />
            <Input placeholder="Телефон или email для связи" />
            <Input placeholder="Удобные день и время" />
            <Textarea placeholder="С чем хотите поработать?" className="min-h-24" />
            <Button type="submit" className="w-full" size="lg">
              Отправить заявку
            </Button>
          </form>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => toast("Чат со специалистом открыт")}
          >
            <MessageCircle className="size-4" /> Написать в чат
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Оплата консультации проходит по ссылке от специалиста.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
