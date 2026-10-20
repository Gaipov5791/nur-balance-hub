import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { customTagId, type Checkin, type Tag } from "@/lib/mood";

const HISTORY_DAYS = 120;

/** Signed-in user's mood check-ins for the last ~4 months (RLS: owner only). */
export function useMoodCheckins() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mood-checkins", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Checkin[]> => {
      const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("mood_checkins")
        .select("id, level, emotions, activities, note, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type CustomTag = Tag & { kind: "emotion" | "activity" };

export function useCustomTags() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["custom-tags", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<CustomTag[]> => {
      const { data, error } = await supabase
        .from("custom_tags")
        .select("kind, label, emoji")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: customTagId(r.label),
        label: r.label,
        emoji: r.emoji,
        kind: r.kind as "emotion" | "activity",
      }));
    },
  });
}

export function useAddCustomTag() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { kind: "emotion" | "activity"; label: string; emoji: string }) => {
      const label = input.label.trim().slice(0, 40);
      const { error } = await supabase
        .from("custom_tags")
        .upsert(
          { user_id: user!.id, kind: input.kind, label, emoji: input.emoji.trim() || "✨" },
          { onConflict: "user_id,kind,label" },
        );
      if (error) throw error;
      return customTagId(label);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-tags"] }),
  });
}

export type CheckinInput = { level: number; emotions: string[]; activities: string[]; note: string };

export function useSaveCheckin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...input }: CheckinInput & { id?: string }) => {
      const row = { ...input, note: input.note.trim().slice(0, 1000) };
      const res = id
        ? await supabase.from("mood_checkins").update(row).eq("id", id)
        : await supabase.from("mood_checkins").insert({ ...row, user_id: user!.id });
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mood-checkins"] }),
  });
}

export function useDeleteCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mood_checkins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mood-checkins"] }),
  });
}
