import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useAuth";
import { useTherapyChats } from "@/hooks/useTherapyChat";
import { priceParts, specItems } from "@/lib/therapists";
import { ensureTherapistCatalog } from "@/lib/therapist-catalog.functions";

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

function Chip({ children }: { children: string }) {
  return (
    <span className="max-w-full rounded-full bg-secondary px-2.5 py-1 text-xs leading-snug text-secondary-foreground">{children}</span>
  );
}

function TherapistPhoto({
  person,
  className,
}: {
  person: Pick<TherapistRow, "photo_url" | "name" | "initials">;
  className: string;
}) {
  if (person.photo_url) {
    return (
      <img
        src={person.photo_url}
        alt={`Фото психолога ${person.name}`}
        loading="lazy"
        className={`${className} object-cover`}
      />
    );
  }
  return (
    <span className={`grid place-items-center bg-primary-soft font-display ${className}`}>
      {person.initials || person.name.slice(0, 2)}
    </span>
  );
}

function ChatHint() {
  return (
    <p className="mt-3 rounded-2xl bg-primary-soft px-3 py-2 text-xs text-primary">
      Общение со специалистом — в чате приложения: он открывается автоматически после подтверждения
      записи.
    </p>
  );
}

function TherapistsPage() {
  const { user, profile } = useProfile();
  const qc = useQueryClient();
  const bookingRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", time: "", topic: "" });
  const [slotId, setSlotId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(50);
  const chats = useTherapyChats();
  const chatByRequest = new Map((chats.data ?? []).map((c) => [c.request_id, c.id]));

  const list = useQuery({
    queryKey: ["therapists"],
    queryFn: async (): Promise<TherapistRow[]> => {
      try {
        await ensureTherapistCatalog();
      } catch {
        // Seed needs the Cloud service role; the list still loads from the table.
      }
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
  const personSpecs = person ? specItems(person.spec) : [];
  const personPrices = person ? priceParts(person.price_label) : [];

  const events = useQuery({
    queryKey: ["therapist-request-events", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<{ id: string; request_id: string; to_status: string; created_at: string }[]> => {
      const { data, error } = await supabase
        .from("therapist_request_events")
        .select("id, request_id, to_status, created_at")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const fittingSlots = (slots.data ?? []).filter((s) => s.duration_minutes >= duration);

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

  const selectTherapist = (id: string) => {
    setSelected(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      window.requestAnimationFrame(() => {
        bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!user || !person) throw new Error("Выберите специалиста");
      if (!form.contact.trim()) throw new Error("Укажите телефон или email для связи");
      const slot = (slots.data ?? []).find((s) => s.id === slotId) ?? null;
      if (slot && slot.duration_minutes < duration) {
        throw new Error("Это окно короче выбранной длительности — выберите другое время");
      }
      const { error } = await supabase.from("therapist_requests").insert({
        user_id: user.id,
        therapist_id: person.id,
        client_name: form.name.trim() || profile?.name || "",
        contact: form.contact.trim(),
        preferred_time: slot ? formatSlot(slot.starts_at, duration) : form.time.trim(),
        topic: form.topic.trim(),
        status: "new",
        duration_minutes: duration,
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
      await qc.invalidateQueries({ queryKey: ["therapist-request-events"] });
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
    await qc.invalidateQueries({ queryKey: ["therapist-request-events"] });
    await qc.invalidateQueries({ queryKey: ["therapist-slots"] });
    toast.success("Заявка отменена");
  };

  return (
    <AppShell title="Психологи" aside={<CoinsPanel />}>
      <p className="mb-4 text-sm text-muted-foreground">
        Выберите специалиста и отправьте заявку — после подтверждения записи откроется личный чат в
        приложении.
      </p>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.95fr)]">
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
            therapists.map((t) => {
              const chips = specItems(t.spec);
              const prices = priceParts(t.price_label);
              const extra = Math.max(0, chips.length - 3);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTherapist(t.id)}
                  className={`surface w-full p-4 text-left transition-shadow hover:shadow-lift sm:p-5 ${
                    person?.id === t.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <span className="flex items-start gap-4">
                    <TherapistPhoto
                      person={t}
                      className="size-20 shrink-0 rounded-2xl sm:size-24"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 font-display text-lg leading-tight">
                        {t.name}
                        {t.is_verified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                            <BadgeCheck className="size-3.5 shrink-0" /> проверен
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {chips.slice(0, 3).map((chip) => (
                          <Chip key={chip}>{chip}</Chip>
                        ))}
                        {extra > 0 ? <Chip>{`ещё ${extra}`}</Chip> : null}
                      </span>
                      {t.experience ? (
                        <span className="mt-2 block text-xs text-muted-foreground">{t.experience}</span>
                      ) : null}
                    </span>
                  </span>
                  {prices.length > 1 ? (
                    <span className="mt-3 grid grid-cols-2 gap-2">
                      {prices.map((p) => (
                        <span key={p} className="rounded-2xl bg-coin/25 px-3 py-2">
                          <span className="block text-[11px] capitalize text-muted-foreground">
                            {p.split(/\s+/)[0]}
                          </span>
                          <span className="block text-sm font-semibold">{p.replace(/^\S+\s+/, "")}</span>
                        </span>
                      ))}
                    </span>
                  ) : t.price_label ? (
                    <span className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-coin/25 px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">Стоимость</span>
                      <span className="text-right text-sm font-semibold">{t.price_label}</span>
                    </span>
                  ) : null}
                </button>
              );
            })
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
                        {r.scheduled_at ? (
                          <p className="mt-1 text-sm font-medium text-primary">
                            Приём: {formatSlot(r.scheduled_at)}
                          </p>
                        ) : null}
                        {r.topic ? <p className="mt-1 text-sm">{r.topic}</p> : null}
                        {(events.data ?? []).some((e) => e.request_id === r.id) ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              История статусов
                            </summary>
                            <ul className="mt-1 space-y-0.5">
                              {(events.data ?? [])
                                .filter((e) => e.request_id === r.id)
                                .map((e) => (
                                  <li key={e.id} className="text-xs text-muted-foreground">
                                    {new Date(e.created_at).toLocaleString("ru-RU")} —{" "}
                                    {REQUEST_STATUS_LABEL[e.to_status] ?? e.to_status}
                                  </li>
                                ))}
                            </ul>
                          </details>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.status === "scheduled" && chatByRequest.get(r.id) ? (
                          <Button asChild size="sm">
                            <Link to="/therapy-chat" search={{ chat: chatByRequest.get(r.id) }}>
                              <MessageCircle className="size-4" /> Написать специалисту
                            </Link>
                          </Button>
                        ) : null}
                        {r.status === "new" || r.status === "in_progress" || r.status === "scheduled" ? (
                          <Button variant="secondary" size="sm" onClick={() => void cancel(r.id)}>
                            Отменить
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>

        <section ref={bookingRef} className="surface min-w-0 scroll-mt-4 p-5 lg:sticky lg:top-4">
          {person ? (
            <div className="mb-4 flex items-start gap-3 border-b border-border pb-4">
              <TherapistPhoto person={person} className="size-16 shrink-0 rounded-2xl text-lg" />
              <div className="min-w-0">
                <h2 className="font-display text-base leading-tight">Записаться к {person.name}</h2>
                {person.experience ? (
                  <p className="mt-1 text-xs text-muted-foreground">{person.experience}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <h2 className="font-display text-base">Записаться на консультацию</h2>
          )}
          {personPrices.length > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              {personPrices.map((p) => (
                <div key={p} className="rounded-2xl bg-coin/25 px-3 py-2">
                  <p className="text-[11px] capitalize text-muted-foreground">{p.split(/\s+/)[0]}</p>
                  <p className="text-sm font-semibold">{p.replace(/^\S+\s+/, "")}</p>
                </div>
              ))}
            </div>
          ) : person?.price_label ? (
            <p className="text-sm text-muted-foreground">{person.price_label}</p>
          ) : null}
          {personSpecs.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {personSpecs.map((chip) => (
                <Chip key={chip}>{chip}</Chip>
              ))}
            </div>
          ) : null}
          {person ? <ChatHint /> : null}
          {person?.bio ? (
            <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-line text-sm leading-relaxed">
              {person.bio}
            </p>
          ) : null}
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
            <div>
              <p className="text-sm font-medium">Длительность консультации</p>
              <div className="mt-2 flex gap-2">
                {[30, 50, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDuration(d);
                      const slot = (slots.data ?? []).find((s) => s.id === slotId);
                      if (slot && slot.duration_minutes < d) setSlotId(null);
                    }}
                    className={`h-11 flex-1 rounded-xl text-sm font-semibold transition-colors ${
                      duration === d
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-primary-soft"
                    }`}
                  >
                    {d} мин
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Свободное время специалиста</p>
              {slots.isLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Загружаем расписание…</p>
              ) : fittingSlots.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  На {duration} минут свободных окон пока нет — выберите другую длительность или
                  напишите удобное время ниже.
                </p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {fittingSlots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSlotId(slotId === s.id ? null : s.id)}
                      className={`rounded-2xl border px-3 py-2 text-left text-sm transition-colors ${
                        slotId === s.id
                          ? "border-primary bg-primary-soft"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      <span className="block font-medium">{formatSlot(s.starts_at)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {duration} мин · {s.format === "offline" ? "офлайн" : "онлайн"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Время закрепляется за вами после подтверждения специалистом.
              </p>
            </div>
            <Input
              placeholder={slotId ? "Комментарий ко времени (необязательно)" : "Удобные день и время"}
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
