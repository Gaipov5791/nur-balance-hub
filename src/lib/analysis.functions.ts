import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  MIN_ANALYSIS_ENTRIES,
  analysisRange,
  buildAnalysisPrompt,
  computeAnalysisStats,
  detectCrisisSignals,
  finalizeAnalysis,
  localDayStartUtc,
  localTodayFromOffset,
  type AnalysisDto,
} from "@/lib/analysis";
import { addDays, type CustomTag } from "@/lib/mood";

const runInput = z.object({
  period: z.enum(["week", "month"]),
  tzOffset: z.number().int().min(-840).max(720),
});

export type RunAnalysisResult =
  | { ok: true; analysis: AnalysisDto; coins: number }
  | { ok: false; reason: "not_enough"; count: number }
  | { ok: false; reason: "insufficient"; coins: number; cost: number }
  | { ok: false; reason: "busy" };

type StartResult =
  | { ok: true; id: string; cost: number; coins: number }
  | { ok: false; reason: "not_enough" | "busy" | "insufficient"; coins?: number; cost?: number };

/** Charges coins (or the subscriber's daily free run), asks NurAI and stores the result; refunds on failure. */
export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => runInput.parse(input))
  .handler(async ({ data, context }): Promise<RunAnalysisResult> => {
    const { supabase } = context;
    const today = localTodayFromOffset(Date.now(), data.tzOffset);
    const { from, to } = analysisRange(data.period, today);

    const [checkinsRes, journalRes, tagsRes] = await Promise.all([
      supabase
        .from("mood_checkins")
        .select("id, level, emotions, activities, note, created_at")
        .gte("created_at", localDayStartUtc(from, data.tzOffset))
        .lt("created_at", localDayStartUtc(addDays(to, 1), data.tzOffset))
        .order("created_at", { ascending: true })
        .limit(1000),
      supabase
        .from("journal_entries")
        .select("entry_date, mood, level, note")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: true })
        .limit(200),
      supabase.from("custom_tags").select("id, kind, label, emoji"),
    ]);
    if (checkinsRes.error || journalRes.error) {
      throw new Error("Не удалось загрузить записи. Попробуй ещё раз");
    }
    const checkins = checkinsRes.data;
    const journal = journalRes.data;
    const custom = (tagsRes.data ?? []).filter(
      (t): t is CustomTag => t.kind === "emotion" || t.kind === "activity",
    );

    const count = checkins.length + journal.length;
    if (count < MIN_ANALYSIS_ENTRIES) return { ok: false, reason: "not_enough", count };

    const { data: startedRaw, error: startError } = await supabase.rpc("start_ai_analysis", {
      _period: data.period,
      _from: from,
      _to: to,
      _entries: count,
    });
    if (startError || !startedRaw) throw new Error("Не удалось начать анализ. Попробуй ещё раз");
    const started = startedRaw as StartResult;
    if (!started.ok) {
      if (started.reason === "insufficient") {
        return {
          ok: false,
          reason: "insufficient",
          coins: started.coins ?? 0,
          cost: started.cost ?? 0,
        };
      }
      if (started.reason === "busy") return { ok: false, reason: "busy" };
      return { ok: false, reason: "not_enough", count };
    }

    try {
      const stats = computeAnalysisStats(checkins, journal, custom);
      const prompt = buildAnalysisPrompt({
        period: data.period,
        from,
        to,
        offsetMinutes: data.tzOffset,
        checkins,
        journal,
        custom,
        stats,
      });
      const { generateAnalysis } = await import("@/lib/analysis.server");
      const output = await generateAnalysis(getRequest(), prompt);
      const texts = [...checkins.map((c) => c.note), ...journal.map((j) => j.note)];
      const result = finalizeAnalysis(output, stats, detectCrisisSignals(texts));
      if (!result.summary) throw new Error("empty analysis");

      const { data: saved, error: saveError } = await supabase.rpc("finish_ai_analysis", {
        _id: started.id,
        _result: result as unknown as Json,
      });
      if (saveError || saved !== true) throw new Error("analysis was not saved");

      return {
        ok: true,
        coins: started.coins,
        analysis: {
          id: started.id,
          period: data.period,
          from,
          to,
          cost: started.cost,
          createdAt: new Date().toISOString(),
          result,
        },
      };
    } catch (err) {
      console.error("ai analysis failed", err);
      await supabase.rpc("fail_ai_analysis", { _id: started.id });
      throw new Error(
        started.cost > 0
          ? `Не получилось подготовить анализ. ${started.cost} коинов вернулись на баланс — попробуй чуть позже`
          : "Не получилось подготовить анализ. Попробуй чуть позже",
      );
    }
  });
