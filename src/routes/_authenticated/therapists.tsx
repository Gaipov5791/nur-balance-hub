import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/therapists")({
  head: () => ({
    meta: [
      { title: "Психологи: каталог и запись на сессию — Nur Balance" },
      {
        name: "description",
        content:
          "Верифицированные психологи: специализация, опыт, стоимость консультации и заявка на сессию со статусом обработки.",
      },
      { property: "og:title", content: "Психологи — Nur Balance" },
      {
        property: "og:description",
        content: "Выберите специалиста и отправьте заявку на консультацию — статус видно в приложении.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TherapistsPage,
});

type TherapistRow = {
  id: string;
  name: string;
  initials: string;
  spec: string;
  experience: string;
  bio: string;
  price_label: string;
  languages: string;
  photo_url: string | null;
  is_verified: boolean;
};

type RequestRow = {
  id: string;
  therapist_id: string;
  preferred_time: string;
  topic: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
};

type SlotRow = {
  id: string;
  therapist_id: string;
  starts_at: string;
  duration_minutes: number;
  format: string;
  is_booked: boolean;
};

export function formatSlot(starts_at: string, duration?: number) {
  const d = new Date(starts_at);
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return duration ? `${date}, ${time} · ${duration} мин` : `${date}, ${time}`;
}

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  new: "новая",
  in_progress: "в работе",
  scheduled: "назначена",
  done: "завершена",
  cancelled: "отменена",
};

function TherapistsPage() {
  const { user, profile } = useProfile();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", time: "", topic: "" });
  const [slotId, setSlotId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["therapists"],
    queryFn: async (): Promise<TherapistRow[]> => {
      const { data, error } = await supabase
        .from("therapists")
        .select("id, name, initials, spec, experience, bio, price_label, languages, photo_url, is_verified")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TherapistRow[];
    },
  });

  const myRequests = useQuery({
    queryKey: ["therapist-requests", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<RequestRow[]> => {
      const { data, error } = await supabase
        .from("therapist_requests")
        .select("id, therapist_id, preferred_time, topic, status, created_at, scheduled_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as RequestRow[];
    },
  });

  const therapists = list.data ?? [];
  const person = therapists.find((t) => t.id === selected) ?? therapists[0] ?? null;

  const slots = useQuery({
    queryKey: ["therapist-slots", person?.id ?? null],
    enabled: !!person,
    queryFn: async (): Promise<SlotRow[]> => {
      const { data, error } = await supabase
        .from("therapist_slots")
        .select("id, therapist_id, starts_at, duration_minutes, format, is_booked")
        .eq("therapist_id", person!.id)
        .eq("is_active", true)
        .eq("is_booked", false)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as SlotRow[];
    },
  });

  useEffect(() => {
    setSlotId(null);
  }, [person?.id]);

  useEffect(() => {
    if (!selected && therapists[0]) setSelected(therapists[0].id);
  }, [selected, therapists]);

  useEffect(() => {
    setForm((f) =>
      f.name ? f : { ...f, name: profile?.name ?? "", contact: f.contact || (user?.email ?? "") },
    );
  }, [profile?.name, user?.email]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user || !person) throw new Error("Выберите специалиста");
      if (!form.contact.trim()) throw new Error("Укажите телефон или email для связи");
      const slot = (slots.data ?? []).find((s) => s.id === slotId) ?? null;
      const { error } = await supabase.from("therapist_requests").insert({
        user_id: user.id,
        therapist_id: person.id,
        client_name: form.name.trim() || profile?.name || "",
        contact: form.contact.trim(),
        preferred_time: slot ? formatSlot(slot.starts_at, slot.duration_minutes) : form.time.trim(),
        topic: form.topic.trim(),
        status: "new",
        slot_id: slot?.id ?? null,
        scheduled_at: slot?.starts_at ?? null,
      });
      if (error) throw new Error("Не удалось отправить заявку. Проверьте связь и попробуйте ещё раз");
    },
    onSuccess: async () => {
      setForm((f) => ({ ...f, time: "", topic: "" }));
      setSlotId(null);
      await qc.invalidateQueries({ queryKey: ["therapist-requests"] });
      await qc.invalidateQueries({ queryKey: ["therapist-slots"] });
      toast.success("Заявка отправлена — специалист свяжется с вами");
    },
    onError: (e: Error) => {
      toast.error(e.message, { action: { label: "Повторить", onClick: () => submit.mutate() } });
    },
  });

  const cancel = async (id: string) => {
    const { error } = await supabase
      .from("therapist_requests")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast.error("Не удалось отменить заявку", {
        action: { label: "Повторить", onClick: () => void cancel(id) },
      });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["therapist-requests"] });
    toast.success("Заявка отменена");
  };

  return (
    <AppShell title="Психологи" aside={<CoinsPanel />}>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="min-w-0 space-y-3">
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Загружаем специалистов…</p>
          ) : list.isError ? (
            <div className="surface p-5">
              <p className="text-sm">Не удалось загрузить список специалистов.</p>
              <Button className="mt-3" variant="secondary" onClick={() => void list.refetch()}>
                Повторить
              </Button>
            </div>
          ) : therapists.length === 0 ? (
            <div className="surface p-5 text-sm text-muted-foreground">
              Пока ни одного специалиста в каталоге.
            </div>
          ) : (
            therapists.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                className={`surface flex w-full items-center gap-4 p-4 text-left transition-shadow hover:shadow-lift ${
                  person?.id === t.id ? "ring-2 ring-primary" : ""
                }`}
              >
                {t.photo_url ? (
                  <img
                    src={t.photo_url}
                    alt={`Фото психолога ${t.name}`}
                    loading="lazy"
                    className="size-16 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary-soft font-display text-lg">
                    {t.initials || t.name.slice(0, 2)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                    {t.name}
                    {t.is_verified ? <BadgeCheck className="size-4 shrink-0 text-primary" /> : null}
                  </span>
                  <span className="block text-sm text-muted-foreground">{t.spec}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[t.experience, t.languages].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="hidden shrink-0 text-sm font-semibold sm:block">{t.price_label}</span>
              </button>
            ))
          )}

          {(myRequests.data ?? []).length > 0 ? (
            <div className="surface p-5">
              <h2 className="font-display text-base">Мои заявки</h2>
              <ul className="mt-3 space-y-3">
                {(myRequests.data ?? []).map((r) => {
                  const t = therapists.find((x) => x.id === r.therapist_id);
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {t?.name ?? "Специалист"}
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-normal ${
                              r.status === "scheduled"
                                ? "bg-primary-soft text-primary"
                                : r.status === "cancelled"
                                  ? "bg-secondary text-muted-foreground"
                                  : "bg-accent/25"
                            }`}
                          >
                            {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Отправлена {new Date(r.created_at).toLocaleString("ru-RU")}
                          {r.preferred_time ? ` · удобное время: ${r.preferred_time}` : ""}
                        </p>
                        {r.topic ? <p className="mt-1 text-sm">{r.topic}</p> : null}
                      </div>
                      {r.status === "new" || r.status === "in_progress" || r.status === "scheduled" ? (
                        <Button variant="secondary" size="sm" onClick={() => void cancel(r.id)}>
                          Отменить
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="surface min-w-0 p-5">
          <h2 className="font-display text-base">
            {person ? `Записаться к ${person.name}` : "Записаться на консультацию"}
          </h2>
          {person ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {person.spec} · {person.price_label}
            </p>
          ) : null}
          {person?.bio ? <p className="mt-2 text-sm">{person.bio}</p> : null}
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <Input
              placeholder="Ваше имя"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Телефон или email для связи"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              required
            />
            <Input
              placeholder="Удобные день и время"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
            <Textarea
              placeholder="С чем хотите поработать?"
              className="min-h-24"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
            <Button type="submit" className="w-full" size="lg" disabled={submit.isPending || !person}>
              {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Отправить заявку
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Заявка сохраняется в приложении: статус обновляется здесь, а специалист свяжется с вами по
            указанному контакту. Оплата консультации проходит по ссылке от специалиста.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
