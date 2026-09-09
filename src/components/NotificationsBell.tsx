import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useAuth";

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useProfile();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["notifications", user?.id ?? null],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  const items = list.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <Popover onOpenChange={(open) => open && void markAllRead()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Уведомления, новых: ${unread}` : "Уведомления"}
          className="relative grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card transition-shadow hover:shadow-soft"
        >
          <Bell className="size-[18px]" />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-display text-sm">Уведомления</p>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Пока нет уведомлений.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className={n.read_at ? "" : "bg-primary-soft/40"}>
                <Link to={n.link || "/"} className="block px-4 py-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("ru-RU")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => void markAllRead()}>
            Отметить всё прочитанным
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
