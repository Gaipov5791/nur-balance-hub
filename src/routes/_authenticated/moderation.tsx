import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, ClipboardList, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TherapistsAdminPanel } from "@/components/TherapistsAdminPanel";
import { TherapistSlotsAdminPanel } from "@/components/TherapistSlotsAdminPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useAuth";
import { loadStaffAccess, canAccessModeration } from "@/lib/staff";
import { formatTime } from "@/components/VideoRecorder";
import { REQUEST_STATUS_LABEL } from "@/routes/_authenticated/therapists";

export const Route = createFileRoute("/_authenticated/moderation")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const access = await loadStaffAccess(data.user.id, data.user.email);
    if (!canAccessModeration(access)) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Модерация жалоб — Nur Balance" },
      {
        name: "description",
        content: "Панель модерации: жалобы из чата поддержки и переписка спорной комнаты.",
      },
      { property: "og:title", content: "Модерация жалоб — Nur Balance" },
      { property: "og:description", content: "Разбор жалоб из чата взаимоподдержки." },
    ],
  }),
  component: ModerationPage,
});

const REASON_LABEL: Record<string, string> = {
  harassment: "Оскорбления или агрессия",
  spam: "Спам или реклама",
  unsafe: "Опасное поведение, угрозы",
  other: "Другое",
};

type Report = {
  id: string;
  match_id: string | null;
  reason: string;
  details: string;
  status: string;
  created_at: string;
};

function ModerationPage() {
  const staffAccess = useStaffAccess();
  const isAdmin = canAccessModeration(staffAccess);
  const { isLoading } = staffAccess;
  const qc = useQueryClient();
  const [openMatch, setOpenMatch] = useState<string | null>(null);

  const reports = useQuery({
    queryKey: ["moderation", "reports"],
    enabled: isAdmin,
    queryFn: async (): Promise<Report[]> => {
      const { data, error } = await supabase
        .from("buddy_reports")
        .select("id, match_id, reason, details, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Report[];
    },
  });

  const thread = useQuery({
    queryKey: ["moderation", "thread", openMatch],
    enabled: !!openMatch,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buddy_messages")
        .select("id, sender_id, kind, body, duration_seconds, created_at")
        .eq("match_id", openMatch!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = async (id: string) => {
    const { error } = await supabase.from("buddy_reports").update({ status: "reviewed" }).eq("id", id);
    if (error) {
      toast.error("Не удалось обновить жалобу");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["moderation", "reports"] });
    toast.success("Жалоба помечена как рассмотренная");
  };

  if (isLoading) {
    return (
      <AppShell title="Модерация">
        <p className="text-sm text-muted-foreground">Загружаем…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Модерация">
        <div className="surface p-6">
          <h2 className="font-display text-lg">Раздел доступен только администратору</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Если доступ нужен, напишите владельцу проекта.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Модерация">
      <TherapistsAdminPanel />
      <TherapistSlotsAdminPanel />
      <TherapistRequestsPanel />
      <ConsultationsAccountingPanel />
      <div className="surface mt-5 p-5">
        <h2 className="flex items-center gap-2 font-display text-base">
          <ShieldCheck className="size-4 text-primary" /> Жалобы из чата поддержки
        </h2>
        {reports.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Загружаем…</p>
        ) : (reports.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Жалоб пока нет.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(reports.data ?? []).map((r) => (
              <li key={r.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {REASON_LABEL[r.reason] ?? r.reason}
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                          r.status === "open" ? "bg-accent/25" : "bg-secondary"
                        }`}
                      >
                        {r.status === "open" ? "новая" : "рассмотрена"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("ru-RU")}
                    </p>
                    {r.details ? <p className="mt-2 text-sm">{r.details}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    {r.match_id ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setOpenMatch(openMatch === r.match_id ? null : r.match_id)}
                      >
                        {openMatch === r.match_id ? "Скрыть переписку" : "Показать переписку"}
                      </Button>
                    ) : null}
                    {r.status === "open" ? (
                      <Button size="sm" onClick={() => void resolve(r.id)}>
                        Рассмотрено
                      </Button>
                    ) : null}
                  </div>
                </div>

                {openMatch === r.match_id ? (
                  <div className="mt-3 space-y-2 rounded-xl bg-secondary/60 p-3">
                    {thread.isLoading ? (
                      <p className="text-xs text-muted-foreground">Загружаем переписку…</p>
                    ) : (thread.data ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Сообщений нет.</p>
                    ) : (
                      (thread.data ?? []).map((m) => (
                        <p key={m.id} className="text-sm">
                          <span className="text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleTimeString("ru-RU", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · {m.sender_id.slice(0, 8)} ·{" "}
                          </span>
                          {m.kind === "text"
                            ? m.body
                            : `${m.kind === "audio" ? "голосовое" : "видео"} сообщение (${formatTime(
                                m.duration_seconds,
                              )})`}
                        </p>
                      ))
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

type AdminRequest = {
  id: string;
  therapist_id: string;
  client_name: string;
  contact: string;
  preferred_time: string;
  topic: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  therapists: { name: string } | null;
};

type RequestEvent = {
  id: string;
  request_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  created_at: string;
};

const NEXT_STATUS: { key: string; label: string }[] = [
  { key: "in_progress", label: "В работу" },
  { key: "scheduled", label: "Назначена" },
  { key: "done", label: "Завершена" },
  { key: "cancelled", label: "Отменить" },
];

function TherapistRequestsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [therapistFilter, setTherapistFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const requests = useQuery({
    queryKey: ["moderation", "therapist-requests"],
    queryFn: async (): Promise<AdminRequest[]> => {
      const { data, error } = await supabase
        .from("therapist_requests")
        .select(
          "id, therapist_id, client_name, contact, preferred_time, topic, status, created_at, scheduled_at, therapists(name)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AdminRequest[];
    },
  });

  const events = useQuery({
    queryKey: ["moderation", "request-events"],
    queryFn: async (): Promise<RequestEvent[]> => {
      const { data, error } = await supabase
        .from("therapist_request_events")
        .select("id, request_id, from_status, to_status, changed_by, created_at")
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as RequestEvent[];
    },
  });

  const all = requests.data ?? [];
  const therapistOptions = Array.from(
    new Map(all.map((r) => [r.therapist_id, r.therapists?.name ?? "Специалист"])).entries(),
  );

  const q = search.trim().toLowerCase();
  const rows = all.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (therapistFilter !== "all" && r.therapist_id !== therapistFilter) return false;
    if (fromDate && new Date(r.created_at) < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && new Date(r.created_at) > new Date(`${toDate}T23:59:59`)) return false;
    if (
      q &&
      !`${r.client_name} ${r.contact} ${r.topic} ${r.therapists?.name ?? ""}`.toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("therapist_requests").update({ status }).eq("id", id);
    if (error) {
      toast.error("Не удалось обновить заявку", {
        action: { label: "Повторить", onClick: () => void setStatus(id, status) },
      });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["moderation", "therapist-requests"] });
    await qc.invalidateQueries({ queryKey: ["moderation", "request-events"] });
    toast.success("Статус заявки обновлён");
  };

  return (
    <div className="surface p-5">
      <h2 className="flex items-center gap-2 font-display text-base">
        <ClipboardList className="size-4 text-primary" /> Заявки к психологам
      </h2>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder="Поиск: имя, контакт, запрос"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Все статусы</option>
          {Object.entries(REQUEST_STATUS_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
          value={therapistFilter}
          onChange={(e) => setTherapistFilter(e.target.value)}
        >
          <option value="all">Все специалисты</option>
          {therapistOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <Button
          variant="secondary"
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
            setTherapistFilter("all");
            setFromDate("");
            setToDate("");
          }}
        >
          Сбросить фильтры
        </Button>
      </div>

      {requests.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Загружаем…</p>
      ) : requests.isError ? (
        <div className="mt-4">
          <p className="text-sm">Не удалось загрузить заявки.</p>
          <Button className="mt-3" variant="secondary" onClick={() => void requests.refetch()}>
            Повторить
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {all.length === 0 ? "Заявок пока нет." : "Ничего не найдено по фильтрам."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {r.therapists?.name ?? "Специалист"} ← {r.client_name || "Без имени"}
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-normal">
                      {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ru-RU")} · {r.contact}
                    {r.preferred_time ? ` · ${r.preferred_time}` : ""}
                  </p>
                  {r.scheduled_at ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Приём: {new Date(r.scheduled_at).toLocaleString("ru-RU")}
                    </p>
                  ) : null}
                  {r.topic ? <p className="mt-2 text-sm">{r.topic}</p> : null}
                  {(events.data ?? []).some((e) => e.request_id === r.id) ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        История изменений
                      </summary>
                      <ul className="mt-1 space-y-0.5">
                        {(events.data ?? [])
                          .filter((e) => e.request_id === r.id)
                          .map((e) => (
                            <li key={e.id} className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleString("ru-RU")} —{" "}
                              {e.from_status
                                ? `${REQUEST_STATUS_LABEL[e.from_status] ?? e.from_status} → `
                                : "создана: "}
                              {REQUEST_STATUS_LABEL[e.to_status] ?? e.to_status}
                              {e.changed_by ? ` · ${e.changed_by.slice(0, 8)}…` : " · система"}
                            </li>
                          ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUS.filter((s) => s.key !== r.status).map((s) => (
                    <Button
                      key={s.key}
                      size="sm"
                      variant={s.key === "cancelled" ? "secondary" : "default"}
                      onClick={() => void setStatus(r.id, s.key)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ConsultationRow = {
  id: string;
  therapist_id: string;
  client_name: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  created_at: string;
  therapists: { name: string } | null;
};

/** Учёт подтверждённых и проведённых консультаций для расчёта комиссии. */
function ConsultationsAccountingPanel() {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [therapistFilter, setTherapistFilter] = useState("all");

  const consultations = useQuery({
    queryKey: ["moderation", "consultations"],
    queryFn: async (): Promise<ConsultationRow[]> => {
      const { data, error } = await supabase
        .from("therapist_requests")
        .select(
          "id, therapist_id, client_name, status, scheduled_at, duration_minutes, created_at, therapists(name)",
        )
        .in("status", ["scheduled", "done"])
        .order("scheduled_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as ConsultationRow[];
    },
  });

  const all = consultations.data ?? [];
  const therapistOptions = Array.from(
    new Map(all.map((r) => [r.therapist_id, r.therapists?.name ?? "Специалист"])).entries(),
  );

  const rows = useMemo(
    () =>
      all.filter((r) => {
        const when = r.scheduled_at ?? r.created_at;
        if (month && !when.startsWith(month)) return false;
        if (therapistFilter !== "all" && r.therapist_id !== therapistFilter) return false;
        return true;
      }),
    [all, month, therapistFilter],
  );

  const totalMinutes = rows.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;

  return (
    <div className="surface mt-5 p-5">
      <h2 className="flex items-center gap-2 font-display text-base">
        <Calculator className="size-4 text-primary" /> Учёт консультаций
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Подтверждённые и проведённые консультации — для расчёта комиссии за месяц.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <select
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
          value={therapistFilter}
          onChange={(e) => setTherapistFilter(e.target.value)}
        >
          <option value="all">Все специалисты</option>
          {therapistOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 rounded-xl bg-primary-soft px-3 py-2 text-sm">
          <span className="font-semibold">{rows.length}</span> консультаций ·
          <span className="font-semibold">
            {totalHours > 0 ? `${totalHours} ч ` : ""}
            {restMinutes} мин
          </span>
        </div>
      </div>

      {consultations.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Загружаем…</p>
      ) : consultations.isError ? (
        <div className="mt-4">
          <p className="text-sm">Не удалось загрузить консультации.</p>
          <Button className="mt-3" variant="secondary" onClick={() => void consultations.refetch()}>
            Повторить
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          За выбранный период консультаций нет.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Психолог</th>
                <th className="py-2 pr-3 font-medium">Клиент</th>
                <th className="py-2 pr-3 font-medium">Дата и время</th>
                <th className="py-2 pr-3 font-medium">Длительность</th>
                <th className="py-2 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 font-medium">{r.therapists?.name ?? "Специалист"}</td>
                  <td className="py-2 pr-3">{r.client_name || "—"}</td>
                  <td className="py-2 pr-3">
                    {r.scheduled_at
                      ? new Date(r.scheduled_at).toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="py-2 pr-3">{r.duration_minutes} мин</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        r.status === "done" ? "bg-secondary" : "bg-primary-soft text-primary"
                      }`}
                    >
                      {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
