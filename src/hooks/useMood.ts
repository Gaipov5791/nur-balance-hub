import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MAX_NOTE, timestampRange, type Checkin, type CustomTag, type TagKind } from "@/lib/mood";

const CHECKIN_FIELDS = "id, level, emotions, activities, note, created_at";

export const moodKeys = {
  all: ["mood"] as const,
  range: (from: string, to: string) => ["mood", "range", from, to] as const,
  one: (id: string) => ["mood", "one", id] as const,
  tags: ["mood", "custom-tags"] as const,
};

/** Check-ins whose local day falls in [from, to], oldest first. */
export function useCheckins(from: string, to: string) {
  return useQuery({
    queryKey: moodKeys.range(from, to),
    queryFn: async (): Promise<Checkin[]> => {
      const { gte, lt } = timestampRange(from, to);
      const { data, error } = await supabase
        .from("mood_checkins")
        .select(CHECKIN_FIELDS)
        .gte("created_at", gte)
        .lt("created_at", lt)
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw new Error("Не удалось загрузить отметки");
      return data ?? [];
    },
  });
}

export function useCheckin(id: string | undefined) {
  return useQuery({
    queryKey: moodKeys.one(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<Checkin | null> => {
      const { data, error } = await supabase
        .from("mood_checkins")
        .select(CHECKIN_FIELDS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw new Error("Не удалось открыть отметку");
      return data;
    },
  });
}

export function useCustomTags() {
  return useQuery({
    queryKey: moodKeys.tags,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CustomTag[]> => {
      const { data, error } = await supabase
        .from("custom_tags")
        .select("id, kind, label, emoji")
        .order("created_at", { ascending: true });
      if (error) throw new Error("Не удалось загрузить свои варианты");
      return (data ?? []).filter(
        (t): t is CustomTag => t.kind === "emotion" || t.kind === "activity",
      );
    },
  });
}

export type CheckinDraft = {
  level: number;
  emotions: string[];
  activities: string[];
  note: string;
  createdAt: string;
};

export function useSaveCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, draft }: { id?: string | undefined; draft: CheckinDraft }) => {
      const row = {
        level: draft.level,
        emotions: draft.emotions,
        activities: draft.activities,
        note: draft.note.trim().slice(0, MAX_NOTE),
        created_at: draft.createdAt,
      };
      const { error } = id
        ? await supabase.from("mood_checkins").update(row).eq("id", id)
        : await supabase.from("mood_checkins").insert(row);
      if (error)
        throw new Error("Не удалось сохранить отметку. Проверь интернет и попробуй ещё раз");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: moodKeys.all }),
  });
}

export function useDeleteCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mood_checkins").delete().eq("id", id);
      if (error) throw new Error("Не удалось удалить отметку");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: moodKeys.all }),
  });
}

export function useDeleteAllCheckins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const checkins = await supabase.from("mood_checkins").delete().eq("user_id", userId);
      if (checkins.error) throw new Error("Не удалось удалить отметки");
      const tags = await supabase.from("custom_tags").delete().eq("user_id", userId);
      if (tags.error) throw new Error("Отметки удалены, но свои варианты удалить не удалось");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: moodKeys.all }),
  });
}

export function useAddCustomTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, label, emoji }: { kind: TagKind; label: string; emoji: string }) => {
      const { error } = await supabase
        .from("custom_tags")
        .upsert(
          { kind, label, emoji: emoji || "✨" },
          { onConflict: "user_id,kind,label", ignoreDuplicates: true },
        );
      if (error) throw new Error("Не удалось добавить вариант");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: moodKeys.tags }),
  });
}
