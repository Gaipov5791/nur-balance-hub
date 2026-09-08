import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ActiveMatch = {
  match_id: string;
  partner_id: string;
  partner_name: string;
  partner_status: string | null;
  started_at: string;
};

export type BuddyMessage = {
  id: string;
  match_id: string;
  sender_id: string;
  kind: "text" | "audio" | "video";
  body: string;
  media_path: string | null;
  duration_seconds: number;
  created_at: string;
};

/** Current active 1-on-1 room, or null. Polls while the user waits in the queue. */
export function useActiveMatch(searching: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["buddy", "match", user?.id ?? null],
    enabled: !!user,
    refetchInterval: searching ? 4000 : false,
    queryFn: async (): Promise<ActiveMatch | null> => {
      const { data, error } = await supabase.rpc("active_buddy_match");
      if (error) throw error;
      return (data?.[0] as ActiveMatch | undefined) ?? null;
    },
  });
}

/** Messages of a room, kept live through realtime inserts. */
export function useBuddyMessages(matchId: string | null) {
  const qc = useQueryClient();
  const key = ["buddy", "messages", matchId];

  const query = useQuery({
    queryKey: key,
    enabled: !!matchId,
    queryFn: async (): Promise<BuddyMessage[]> => {
      const { data, error } = await supabase
        .from("buddy_messages")
        .select("id, match_id, sender_id, kind, body, media_path, duration_seconds, created_at")
        .eq("match_id", matchId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BuddyMessage[];
    },
  });

  useEffect(() => {
    if (!matchId) return;
    const channel = supabase
      .channel(`buddy-room-${matchId}`)
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
          qc.setQueryData<BuddyMessage[]>(key, (prev) => {
            if (!prev) return [row];
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  return query;
}

/** Signed URL for a private chat media file. */
export function useSignedMedia(path: string | null) {
  return useQuery({
    queryKey: ["buddy", "media", path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from("buddy-media")
        .createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
}
