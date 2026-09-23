import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatSlot } from "@/routes/_authenticated/therapists";

export const Route = createFileRoute("/_authenticated/therapist-desk")({
  head: () => ({
    meta: [
      { title: "Кабинет специалиста — Nur Balance" },
      {
        name: "description",
        content: "Заявки клиентов, подтверждение времени консультации и расписание специалиста.",
      },
      { property: "og:title", content: "Кабинет специалиста — Nur Balance" },
      {
        property: "og:description",
        content: "Подтверждайте заявки и фиксируйте дату, время и длительность консультации.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TherapistDeskPage,
});

type DeskRequest = {
  id: string;
  client_name: string;
  contact: string;
  preferred_time: string;
  topic: string;
  status: string;
  duration_minutes: number;
  scheduled_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  new: "Ожидает подтверждения",
  in_progress: "В работе",
  scheduled: "Подтверждена",
  done: "Завершена",
  cancelled: "Отменена",
};

function TherapistDeskPage() {
  const { user } = useProfile();
  const qc = useQueryClient();

  const card = useQuery({
    queryKey: ["my-therapist-card", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("id, name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const requests = useQuery({
    queryKey: ["desk-requests", card.data?.id ?? null],
    enabled: !!card.data?.id,
    queryFn: async (): Promise<DeskRequest[]> => {
      const { data, error } = await supabase
        .from("therapist_requests")
        .select(
          "id, client_name, contact, preferred_time, topic, status, duration_minutes, scheduled_at, created_at",
        )
        .eq("therapist_id", card.data!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as DeskRequest[];
    },
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("therapist_requests").update({ status }).eq("id", id);
    if (error) {
      toast.error("Не удалось обновить заявку", {
        action: { label: "Повторить", onClick: () => void setStatus(id, status) },
      });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["desk-requests"] });
    await qc.invalidateQueries({ queryKey: ["therapist-slots"] });
    toast.success(status === "scheduled" ? "Время подтверждено" : "Статус обновлён");
  };

  return (
    <AppShell title="Кабинет специалиста">
      {card.isLoading ? (
        <div className="surface grid place-items-center p-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !card.data ? (
        <div className="surface p-6 text-center">
          <p className="font-semibold">Кабинет пока не привязан</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Попросите администратора связать вашу карточку в каталоге с этим аккаунтом.
          </p>
        </div>
      ) : (
        <section className="surface p-5">
          <h2 className="flex items-center gap-2 font-display text-base">
            <CalendarClock className="size-4 text-primary" /> Заявки — {card.data.name}
          </h2>

          {requests.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Загружаем заявки…</p>
          ) : (requests.data ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Заявок пока нет.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(requests.data ?? []).map((r) => (
                <li key={r.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold">
                      {r.client_name || "Клиент"} · {r.duration_minutes} мин
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        r.status === "scheduled"
                          ? "bg-primary-soft text-primary"
                          : r.status === "cancelled"
                            ? "bg-secondary text-muted-foreground"
                            : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Контакт: {r.contact || "—"}
                    {r.preferred_time ? ` · время: ${r.preferred_time}` : ""}
                  </p>
                  {r.scheduled_at ? (
                    <p className="mt-1 text-sm">
                      Назначено: {formatSlot(r.scheduled_at, r.duration_minutes)}
                    </p>
                  ) : null}
                  {r.topic ? <p className="mt-2 text-sm">{r.topic}</p> : null}

                  {r.status === "new" || r.status === "in_progress" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void setStatus(r.id, "scheduled")}>
                        <CheckCircle2 className="size-4" /> Подтвердить время
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void setStatus(r.id, "cancelled")}
                      >
                        <XCircle className="size-4" /> Отклонить
                      </Button>
                    </div>
                  ) : r.status === "scheduled" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => void setStatus(r.id, "done")}>
                        Консультация состоялась
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void setStatus(r.id, "cancelled")}>
                        Отменить
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </AppShell>
  );
}
