import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveMatch, type BuddyMessage } from "@/hooks/useBuddyChat";

const UNREAD_KEY = ["buddy", "unread"];

function previewOf(row: BuddyMessage) {
  if (row.kind === "audio") return "🎤 Голосовое сообщение";
  if (row.kind === "video") return "🎬 Видео-сообщение";
  const text = row.body.trim();
  return text.length > 80 ? `${text.slice(0, 80)}…` : text || "Новое сообщение";
}

/** Count of unread buddy messages, shared across the app. */
export function useBuddyUnread() {
  const { data } = useQuery<number>({
    queryKey: UNREAD_KEY,
    queryFn: () => 0,
    initialData: 0,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? 0;
}

/**
 * App-wide listener: keeps the buddy room live and notifies about incoming
 * messages no matter which section the user is currently on.
 */
export function useBuddyNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: match } = useActiveMatch(false);
  const matchId = match?.match_id ?? null;

  // Reading the room clears the badge.
  useEffect(() => {
    if (pathname === "/buddy") qc.setQueryData(UNREAD_KEY, 0);
  }, [pathname, qc]);

  // Pick up a room that started while the user was in another section.
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => {
      void qc.invalidateQueries({ queryKey: ["buddy", "match", user.id] });
    }, 30000);
    return () => window.clearInterval(id);
  }, [user?.id, qc]);

  useEffect(() => {
    if (!matchId || !user) return;
    const channel = supabase
      .channel(`buddy-notify-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "buddy_messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as BuddyMessage;
          if (row.sender_id === user.id) return;

          // Keep the room cache warm so the chat is already up to date.
          qc.setQueryData<BuddyMessage[]>(["buddy", "messages", matchId], (prev) => {
            if (!prev) return prev;
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });

          const onRoom =
            window.location.pathname === "/buddy" && document.visibilityState === "visible";
          if (onRoom) return;

          qc.setQueryData<number>(UNREAD_KEY, (n) => (n ?? 0) + 1);
          toast(match?.partner_name ?? "Новое сообщение", {
            description: previewOf(row),
            action: {
              label: "Открыть",
              onClick: () => {
                void navigate({ to: "/buddy" });
              },
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, user?.id]);
}
