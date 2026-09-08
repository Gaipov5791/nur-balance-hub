import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useAuth";
import { formatTime } from "@/components/VideoRecorder";

export const Route = createFileRoute("/_authenticated/moderation")({
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
  const { isAdmin, isLoading } = useIsAdmin();
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
          <h2 className="font-display text-lg">Раздел доступен только модераторам</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Если вам нужен доступ к разбору жалоб, напишите администратору проекта.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Модерация жалоб">
      <div className="surface p-5">
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
