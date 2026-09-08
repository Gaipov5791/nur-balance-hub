import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { moodKeys, type MoodKey } from "@/data/demo";

export const VIDEO_BUCKET = "journal-videos";
export const MAX_RECORD_SECONDS = 180;
const SIGNED_URL_TTL = 60 * 60; // 1 hour

/** Coin rules (approved by the client, see «Правила Nur-Coins»). */
const COIN_JOURNAL = 10;
const COIN_MOOD = 5;
const COIN_FIRST_ENTRY = 20;
const DAILY_LIMIT = 30;
const STREAK_MILESTONES: Record<number, number> = { 3: 10, 7: 30, 14: 50, 30: 100 };
/** Actions that count against the daily limit. Bonuses (first entry, streak) do not. */
const LIMITED_ACTIONS = ["journal_daily", "mood", "practice", "buddy"];

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

function daysBetween(a: string, b: string) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export const createJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // The path must live inside the caller's own folder — never trust a foreign path.
    for (const p of [data.videoPath, data.thumbnailPath]) {
      if (p && !p.startsWith(`${userId}/`)) throw new Error("Недопустимый путь файла");
    }

    // The client sends its local date; reject anything far from server time.
    const serverToday = new Date().toISOString().slice(0, 10);
    if (Math.abs(daysBetween(serverToday, data.entryDate)) > 1) {
      throw new Error("Некорректная дата записи");
    }

    const { data: entry, error: insertError } = await supabase
      .from("journal_entries")
      .insert({
        user_id: userId,
        entry_date: data.entryDate,
        mood: data.mood,
        level: data.level,
        note: data.note,
        duration_seconds: data.durationSeconds,
        video_path: data.videoPath,
        thumbnail_path: data.thumbnailPath,
        mime_type: data.mimeType,
        file_size: data.fileSize,
      })
      .select("id")
      .single();
    if (insertError || !entry) {
      throw new Error(`Не удалось сохранить запись: ${insertError?.message ?? "unknown"}`);
    }

    // ---- Coins & streak (server-side only) ----
    const day = data.entryDate;
    const [{ data: profile }, { data: txs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("coins, streak, last_entry_date")
        .eq("id", userId)
        .single(),
      supabase.from("coin_transactions").select("action, amount").eq("user_id", userId),
    ]);

    const done = new Set((txs ?? []).map((t) => t.action));
    const earnedToday = (txs ?? [])
      .filter((t) => LIMITED_ACTIONS.some((a) => t.action === `${a}:${day}`))
      .reduce((s, t) => s + t.amount, 0);

    let remaining = Math.max(0, DAILY_LIMIT - earnedToday);
    const awards: { action: string; amount: number; label: string }[] = [];

    const limited = (action: string, amount: number, label: string) => {
      if (done.has(action) || remaining <= 0) return;
      const granted = Math.min(amount, remaining);
      remaining -= granted;
      awards.push({ action, amount: granted, label });
    };

    limited(`journal_daily:${day}`, COIN_JOURNAL, "Запись дневника");
    limited(`mood:${day}`, COIN_MOOD, "Эмоция и интенсивность");
    if (!done.has("first_entry")) {
      awards.push({ action: "first_entry", amount: COIN_FIRST_ENTRY, label: "Первая запись" });
    }

    // Streak: consecutive days, one missed day is forgiven.
    let streak = profile?.streak ?? 0;
    let lastDate = profile?.last_entry_date ?? null;
    if (!lastDate) {
      streak = 1;
    } else {
      const diff = daysBetween(lastDate, day);
      if (diff >= 1 && diff <= 2) streak += 1;
      else if (diff > 2) streak = 1;
      else if (diff < 0) {
        /* backdated entry — keep the streak as is */
      }
    }
    if (!lastDate || daysBetween(lastDate, day) > 0) lastDate = day;

    const bonus = STREAK_MILESTONES[streak];
    if (bonus && !done.has(`streak:${streak}`)) {
      awards.push({ action: `streak:${streak}`, amount: bonus, label: `Серия ${streak} дней` });
    }

    const total = awards.reduce((s, a) => s + a.amount, 0);

    if (awards.length) {
      await supabase.from("coin_transactions").insert(
        awards.map((a) => ({
          user_id: userId,
          action: a.action,
          amount: a.amount,
          entry_id: entry.id,
        })),
      );
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        coins: (profile?.coins ?? 0) + total,
        streak,
        last_entry_date: lastDate,
      })
      .eq("id", userId);
    if (profileError) console.error("profile update failed", profileError);

    return {
      entryId: entry.id,
      awards,
      total,
      coins: (profile?.coins ?? 0) + total,
      streak,
    };
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
