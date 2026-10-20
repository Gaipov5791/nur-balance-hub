import { useQuery } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/** Admin-only list of «Написать» messages (RLS: admins read). */
export function FeedbackAdminPanel() {
  const q = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_feedback")
        .select("id, message, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        <MessageSquareText className="size-5 text-primary" /> Идеи и отзывы пользователей
        {q.data ? <span className="text-sm font-normal text-muted-foreground">· {q.data.length}</span> : null}
      </h2>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Загружаем…</p>
      ) : q.isError ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          Не удалось загрузить отзывы.
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>Повторить</Button>
        </div>
      ) : !q.data?.length ? (
        <p className="text-sm text-muted-foreground">Пока нет сообщений.</p>
      ) : (
        <ul className="max-h-[480px] space-y-2 overflow-y-auto">
          {q.data.map((f) => (
            <li key={f.id} className="rounded-2xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                {new Date(f.created_at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{f.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
