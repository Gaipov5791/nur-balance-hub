import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { moodKeys, type MoodKey } from "@/data/demo";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { MAX_RECORD_SECONDS } from "@/lib/economy";
import { assertNearbyEntryDate, assertOwnedStoragePath, utcToday } from "@/lib/journal-guards";

export const VIDEO_BUCKET = "journal-videos";
export { MAX_RECORD_SECONDS };
const SIGNED_URL_TTL = 60 * 60; // 1 hour

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createInput = z.object({
  entryDate: dateSchema,
  mood: z.enum(moodKeys as [MoodKey, ...MoodKey[]]),
  level: z.number().int().min(1).max(5),
  note: z.string().max(2000).default(""),
  durationSeconds: z.number().int().min(1).max(MAX_RECORD_SECONDS + 5),
  videoPath: z.string().min(1).max(500),
  thumbnailPath: z.string().min(1).max(500).nullable(),
  mimeType: z.string().max(100).nullable(),
  fileSize: z.number().int().min(0),
});

export type CreateEntryInput = z.infer<typeof createInput>;

export type JournalEntryDto = {
  id: string;
  entryDate: string;
  mood: MoodKey;
  level: number;
  note: string;
  durationSeconds: number;
  videoPath: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
};

function asSaveResult(data: Json | null) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Не удалось сохранить запись");
  }
  const o = data as Record<string, Json | undefined>;
  const rawAwards = o["awards"];
  const awards = Array.isArray(rawAwards)
    ? rawAwards.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, Json | undefined>;
        return [
          {
            action: String(row["action"] ?? ""),
            amount: Number(row["amount"] ?? 0),
            label: String(row["label"] ?? ""),
          },
        ];
      })
    : [];
  return {
    entryId: String(o["entryId"] ?? ""),
    awards,
    total: Number(o["total"] ?? 0),
    coins: Number(o["coins"] ?? 0),
    streak: Number(o["streak"] ?? 0),
  };
}

export const createJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    assertOwnedStoragePath(userId, data.videoPath);
    assertOwnedStoragePath(userId, data.thumbnailPath);
    assertNearbyEntryDate(data.entryDate, utcToday());

    const { data: result, error } = await supabase.rpc("save_journal_entry", {
      _entry_date: data.entryDate,
      _mood: data.mood,
      _level: data.level,
      _note: data.note,
      _duration: data.durationSeconds,
      _video_path: data.videoPath,
      _thumbnail_path: data.thumbnailPath,
      _mime_type: data.mimeType ?? "",
      _file_size: data.fileSize,
    });
    if (error) throw new Error(`Не удалось сохранить запись: ${error.message}`);
    return asSaveResult(result);
  });

export const listJournalEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JournalEntryDto[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, entry_date, mood, level, note, duration_seconds, video_path, thumbnail_path, created_at")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Не удалось загрузить записи: ${error.message}`);

    const thumbPaths = data.map((e) => e.thumbnail_path).filter((p): p is string => !!p);
    const thumbs = new Map<string, string>();
    if (thumbPaths.length) {
      const { data: signed } = await supabase.storage
        .from(VIDEO_BUCKET)
        .createSignedUrls(thumbPaths, SIGNED_URL_TTL);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl && !s.error) thumbs.set(s.path, s.signedUrl);
      }
    }

    return data.map((e) => ({
      id: e.id,
      entryDate: e.entry_date,
      mood: (moodKeys.includes(e.mood as MoodKey) ? e.mood : "calm") as MoodKey,
      level: e.level,
      note: e.note,
      durationSeconds: e.duration_seconds,
      videoPath: e.video_path,
      thumbnailUrl: e.thumbnail_path ? (thumbs.get(e.thumbnail_path) ?? null) : null,
      createdAt: e.created_at,
    }));
  });

export const getEntryPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ entryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS restricts this read to the owner (or an admin role).
    const { data: entry, error } = await supabase
      .from("journal_entries")
      .select("video_path, mime_type")
      .eq("id", data.entryId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!entry?.video_path) throw new Error("Видео для этой записи не найдено");

    const { data: signed, error: signError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(entry.video_path, SIGNED_URL_TTL);
    if (signError || !signed) throw new Error("Не удалось открыть видео. Попробуйте ещё раз");
    return { url: signed.signedUrl, mimeType: entry.mime_type, expiresIn: SIGNED_URL_TTL };
  });

export const deleteJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ entryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: entry } = await supabase
      .from("journal_entries")
      .select("video_path, thumbnail_path")
      .eq("id", data.entryId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!entry) throw new Error("Запись не найдена");
    const paths = [entry.video_path, entry.thumbnail_path].filter((p): p is string => !!p);
    if (paths.length) await supabase.storage.from(VIDEO_BUCKET).remove(paths);
    const { error } = await supabase.from("journal_entries").delete().eq("id", data.entryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
