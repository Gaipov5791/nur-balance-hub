import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  users_total: number; users_onboarded: number; users_new_7: number; users_new_30: number;
  active_7: number; active_30: number; journal_authors: number;
  entries_total: number; entries_audio: number; entries_video: number;
  requests_by_status: Record<string, number>; buddy_matches: number; therapist_chats: number;
  daily: { day: string; signups: number; entries: number }[];
};

const STATUS: Record<string, string> = {
  new: "новые", in_progress: "в работе", scheduled: "назначены", done: "завершены", cancelled: "отменены",
};

export function UserStatsPanel() {
  const q = useQuery({
    queryKey: ["admin-user-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_stats" as never);
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        <BarChart3 className="size-5 text-primary" /> Статистика пользователей
      </h2>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Загружаем цифры…</p>
      ) : q.isError || !q.data ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          Не удалось загрузить статистику.
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>Повторить</Button>
        </div>
      ) : (
        <Body s={q.data} />
      )}
    </section>
  );
}

function Body({ s }: { s: Stats }) {
  const requests = Object.values(s.requests_by_status).reduce((a, b) => a + b, 0);
  const cards: [string, string | number, string?][] = [
    ["Зарегистрировано", s.users_total, `прошли онбординг: ${s.users_onboarded}`],
    ["Новые", s.users_new_7, `за 7 дней · за 30 дней: ${s.users_new_30}`],
    ["Активные", s.active_7, `за 7 дней · за 30 дней: ${s.active_30}`],
    ["Ведут дневник", s.journal_authors, "хотя бы одна запись"],
    ["Записей в дневнике", s.entries_total, `видео: ${s.entries_video} · голос: ${s.entries_audio}`],
    ["Заявки психологам", requests,
      Object.entries(s.requests_by_status).map(([k, v]) => `${STATUS[k] ?? k}: ${v}`).join(" · ") || "пока нет"],
    ["Круг поддержки", s.buddy_matches, "разговоров создано"],
    ["Чаты со специалистами", s.therapist_chats, "открыто после подтверждения"],
  ];
  const daily = s.daily.map((d) => ({ ...d, day: d.day.slice(5).split("-").reverse().join(".") }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([t, v, hint]) => (
          <div key={t} className="min-w-0 rounded-2xl bg-muted/50 p-4">
            <div className="text-xs text-muted-foreground">{t}</div>
            <div className="font-display text-2xl font-semibold">{v}</div>
            {hint ? <div className="mt-1 break-words text-xs text-muted-foreground">{hint}</div> : null}
          </div>
        ))}
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Регистрации и записи за 30 дней</div>
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
              <Tooltip />
              <Legend />
              <Bar dataKey="signups" name="Регистрации" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="entries" name="Записи" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
