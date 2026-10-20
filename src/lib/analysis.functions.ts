import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { analysisStats, buildAnalyzerInput } from "@/lib/analysis-input";
import type { AnalysisResult, AnalysisRow } from "@/lib/wallet";

export type RunAnalysisResponse =
  | { ok: true; analysis: AnalysisRow }
  | { ok: false; reason: "not_enough" | "insufficient" | "busy" | "ai_error"; message: string; entries?: number | undefined; coins?: number | undefined };

const START_MESSAGES: Record<string, string> = {
  not_enough: "Нужно минимум 3 записи за период — отметь настроение ещё пару раз.",
  insufficient: "Не хватает Nur-Coins для анализа.",
  busy: "Предыдущий анализ ещё готовится. Подожди немного.",
};

const clean = (s: unknown, n = 600) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/**
 * Runs the paid AI mood analysis: Postgres charges coins (or the daily subscription analysis),
 * the AI reads the period's entries, and the result is stored. On AI failure coins are refunded.
 */
export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ period: z.enum(["week", "month"]) }).parse(input))
  .handler(async ({ data, context }): Promise<RunAnalysisResponse> => {
    const { supabase, userId } = context;
    const { data: started, error } = await supabase.rpc("start_ai_analysis", { _period: data.period });
    if (error) throw new Error("Не удалось начать анализ. Попробуй ещё раз");
    const s = (started ?? {}) as Record<string, Json | undefined>;
    if (s["ok"] !== true) {
      const reason = String(s["reason"] ?? "busy") as "not_enough" | "insufficient" | "busy";
      return {
        ok: false,
        reason,
        message: START_MESSAGES[reason] ?? "Не удалось начать анализ",
        entries: typeof s["entries"] === "number" ? s["entries"] : undefined,
        coins: typeof s["coins"] === "number" ? s["coins"] : undefined,
      };
    }
    const id = String(s["id"]);
    const start = String(s["period_start"]);
    const end = String(s["period_end"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const [checkinsRes, journalRes, tagsRes] = await Promise.all([
        supabase
          .from("mood_checkins")
          .select("level, emotions, activities, note, created_at")
          .eq("user_id", userId)
          .gte("created_at", `${start}T00:00:00+05:00`)
          .lte("created_at", `${end}T23:59:59.999+05:00`)
          .order("created_at")
          .limit(500),
        supabase
          .from("journal_entries")
          .select("entry_date, mood, level, note")
          .eq("user_id", userId)
          .gte("entry_date", start)
          .lte("entry_date", end)
          .order("entry_date")
          .limit(200),
        supabase.from("custom_tags").select("label, emoji").eq("user_id", userId),
      ]);
      if (checkinsRes.error || journalRes.error) throw new Error("data");
      const checkins = checkinsRes.data ?? [];
      const journal = journalRes.data ?? [];
      const custom = new Map((tagsRes.data ?? []).map((t) => [`c:${t.label}`, { id: `c:${t.label}`, label: t.label, emoji: t.emoji }]));

      const prompt = buildAnalyzerInput({
        periodLabel: data.period === "week" ? "неделя" : "месяц",
        start,
        end,
        checkins,
        journal,
        custom,
      });
      const { runMoodAnalyzer } = await import("@/lib/analysis.server");
      const out = await runMoodAnalyzer(prompt);

      const result: AnalysisResult = {
        summary: clean(out.summary, 1200),
        moodTrend: clean(out.mood_trend, 800),
        emotions: out.emotions.slice(0, 4).map((e) => ({ name: clean(e.name, 60), insight: clean(e.insight, 400) })),
        helps: out.helps.slice(0, 4).map((x) => clean(x, 200)).filter(Boolean),
        drains: out.drains.slice(0, 4).map((x) => clean(x, 200)).filter(Boolean),
        recommendations: out.recommendations
          .slice(0, 3)
          .map((r) => ({ title: clean(r.title, 80), text: clean(r.text, 400) })),
        supportNote: out.support_note ? clean(out.support_note, 800) || null : null,
        stats: analysisStats(checkins, journal),
      };

      const { data: saved, error: saveErr } = await supabaseAdmin.rpc("complete_ai_analysis", {
        _id: id,
        _result: result as unknown as Json,
      });
      if (saveErr || saved !== true) throw new Error("save");

      return {
        ok: true,
        analysis: {
          id,
          period: data.period,
          period_start: start,
          period_end: end,
          entries_count: Number(s["entries"] ?? result.stats.entries),
          paid_with: s["paid_with"] === "subscription" ? "subscription" : "coins",
          cost: Number(s["cost"] ?? 0),
          status: "done",
          result,
          created_at: new Date().toISOString(),
        },
      };
    } catch (e) {
      const msg = e instanceof Error && e.name === "AnalyzerError" ? e.message : "";
      await supabaseAdmin.rpc("fail_ai_analysis", { _id: id, _error: msg || (e instanceof Error ? e.message : "error") });
      return {
        ok: false,
        reason: "ai_error",
        message: `${msg || "Не удалось получить анализ."} Списание отменено — можно попробовать снова.`,
      };
    }
  });
