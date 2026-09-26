import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TherapyChat = {
  id: string;
  request_id: string;
  client_id: string;
  therapist_id: string;
  therapist_name: string;
  therapist_user_id: string | null;
  created_at: string;
};

export type TherapyMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  kind: "text" | "audio" | "image" | "file";
  body: string;
  media_path: string | null;
  duration_seconds: number;
  created_at: string;
};

/** All chats of the current user (as client or as therapist). */
export function useTherapyChats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["therapy-chats", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<TherapyChat[]> => {
      const { data, error } = await supabase
        .from("therapist_chats")
        .select("id, request_id, client_id, therapist_id, created_at, therapists(name, user_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const t = row.therapists as { name: string; user_id: string | null } | null;
        return {
          id: row.id,
          request_id: row.request_id,
          client_id: row.client_id,
          therapist_id: row.therapist_id,
          therapist_name: t?.name ?? "Специалист",
          therapist_user_id: t?.user_id ?? null,
          created_at: row.created_at,
        };
      });
    },
  });
}

/** Messages of one chat, kept live through realtime inserts. */
export function useTherapyMessages(chatId: string | null) {
  const qc = useQueryClient();
  const key = ["therapy-messages", chatId];

  const query = useQuery({
    queryKey: key,
    enabled: !!chatId,
    queryFn: async (): Promise<TherapyMessage[]> => {
      const { data, error } = await supabase
        .from("therapist_messages")
        .select("id, chat_id, sender_id, kind, body, media_path, duration_seconds, created_at")
        .eq("chat_id", chatId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TherapyMessage[];
    },
  });

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`therapy-room-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "therapist_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const row = payload.new as TherapyMessage;
          qc.setQueryData<TherapyMessage[]>(key, (prev) => {
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
  }, [chatId]);

  return query;
}

/** Signed URL for a private chat attachment. */
export function useTherapyMedia(path: string | null) {
  return useQuery({
    queryKey: ["therapy-media", path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from("therapist-media")
        .createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
}
