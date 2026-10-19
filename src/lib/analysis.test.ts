import { describe, expect, it } from "vitest";
import {
  analysisRange,
  buildAnalysisPrompt,
  computeAnalysisStats,
  detectCrisisSignals,
  finalizeAnalysis,
  localDayStartUtc,
  localTodayFromOffset,
  parseAnalysisResult,
  type AnalysisOutput,
} from "@/lib/analysis";
import type { Checkin } from "@/lib/mood";

const checkin = (over: Partial<Checkin>): Checkin => ({
  id: crypto.randomUUID(),
  level: 3,
  emotions: [],
  activities: [],
  note: "",
  created_at: "2026-10-15T06:00:00.000Z",
  ...over,
});

describe("analysis period", () => {
  it("covers the last 7 or 30 days including today", () => {
    expect(analysisRange("week", "2026-10-19")).toEqual({ from: "2026-10-13", to: "2026-10-19" });
    expect(analysisRange("month", "2026-10-19")).toEqual({ from: "2026-09-20", to: "2026-10-19" });
  });

  it("uses the browser offset for the local day", () => {
    const almaty = -300;
    expect(localTodayFromOffset(Date.parse("2026-10-19T20:30:00Z"), almaty)).toBe("2026-10-20");
    expect(localTodayFromOffset(Date.parse("2026-10-19T18:00:00Z"), almaty)).toBe("2026-10-19");
    expect(localDayStartUtc("2026-10-20", almaty)).toBe("2026-10-19T19:00:00.000Z");
  });
});

describe("detectCrisisSignals", () => {
  it("catches self-harm and violence wording", () => {
    expect(detectCrisisSignals(["Иногда кажется, что не хочу жить"])).toBe(true);
    expect(detectCrisisSignals(["думаю покончить с собой"])).toBe(true);
    expect(detectCrisisSignals(["Хочется причинить себе боль"])).toBe(true);
    expect(detectCrisisSignals(["Муж опять меня бьёт"])).toBe(true);
  });

  it("stays quiet on ordinary notes", () => {
    expect(detectCrisisSignals(["Устала на работе, но вечер с друзьями помог", ""])).toBe(false);
  });
});

describe("buildAnalysisPrompt", () => {
  it("includes stats, labels, local time and notes", () => {
    const checkins = [
      checkin({
        level: 4,
        emotions: ["joy", "c:Азарт"],
        activities: ["walk"],
        note: "Гуляли в парке",
      }),
      checkin({
        level: 2,
        emotions: ["anxiety"],
        activities: ["work"],
        created_at: "2026-10-16T15:10:00.000Z",
      }),
    ];
    const journal = [{ entry_date: "2026-10-17", mood: "tired", level: 4, note: "Долгий день" }];
    const custom = [{ id: "1", kind: "emotion" as const, label: "Азарт", emoji: "🔥" }];
    const stats = computeAnalysisStats(checkins, journal, custom);
    const prompt = buildAnalysisPrompt({
      period: "week",
      from: "2026-10-13",
      to: "2026-10-19",
      offsetMinutes: -300,
      checkins,
      journal,
      custom,
      stats,
    });
    expect(prompt).toContain("последние 7 дней");
    expect(prompt).toContain("Отметок настроения: 2. Записей дневника: 1.");
    expect(prompt).toContain("Среднее настроение: 3 из 5");
    expect(prompt).toContain("15.10 11:00 · Хорошее (4)");
    expect(prompt).toContain("эмоции: Радость, Азарт");
    expect(prompt).toContain("активности: Прогулка");
    expect(prompt).toContain("заметка: «Гуляли в парке»");
    expect(prompt).toContain("16.10 20:10 · Плохое (2)");
    expect(prompt).toContain("17.10 · Усталость, сила 4/5 · текст: «Долгий день»");
  });
});

describe("finalizeAnalysis", () => {
  const stats = computeAnalysisStats([checkin({ level: 5 })], [], []);
  const output: AnalysisOutput = {
    summary: "  Неделя была  ровной. ",
    influences: Array.from({ length: 7 }, (_, i) => ({
      title: `Фактор ${i}`,
      detail: "Деталь",
      effect: "positive" as const,
    })),
    recommendations: [
      { title: "", detail: "пусто" },
      { title: "Прогулка", detail: "10 минут вечером" },
    ],
    crisis: false,
  };

  it("trims lists, drops empty items and keeps stats", () => {
    const r = finalizeAnalysis(output, stats, false);
    expect(r.summary).toBe("Неделя была ровной.");
    expect(r.influences).toHaveLength(5);
    expect(r.recommendations).toEqual([{ title: "Прогулка", detail: "10 минут вечером" }]);
    expect(r.stats.avg).toBe(5);
    expect(r.crisis).toBe(false);
  });

  it("raises the crisis flag from the keyword check", () => {
    expect(finalizeAnalysis(output, stats, true).crisis).toBe(true);
  });

  it("round-trips through the stored-result parser", () => {
    const r = finalizeAnalysis(output, stats, false);
    expect(parseAnalysisResult(JSON.parse(JSON.stringify(r)))).toEqual(r);
    expect(parseAnalysisResult({ summary: "x" })).toBeNull();
  });
});
