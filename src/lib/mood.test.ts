import { describe, expect, it } from "vitest";
import { canSaveCheckin, dailyAverages, dominantLevel, JOURNAL_MOOD_LEVEL, MOOD_LEVELS, moodDistribution } from "./mood";

describe("mood tracker rules", () => {
  it("has five levels with the colors from the brief", () => {
    expect(MOOD_LEVELS.map((m) => [m.label, m.color])).toEqual([
      ["Очень плохое", "var(--mood-1)"],
      ["Плохое", "var(--mood-2)"],
      ["Нормальное", "var(--mood-3)"],
      ["Хорошее", "var(--mood-4)"],
      ["Отличное", "var(--mood-5)"],
    ]);
  });

  it("refuses to save without a mood", () => {
    expect(canSaveCheckin({ level: null })).toBe(false);
    expect(canSaveCheckin({ level: 3 })).toBe(true);
  });

  it("computes percentages from saved check-ins", () => {
    const d = moodDistribution([{ level: 4 }, { level: 4 }, { level: 2 }, { level: 5 }]);
    expect(d.find((x) => x.level === 4)?.percent).toBe(50);
    expect(d.find((x) => x.level === 2)?.percent).toBe(25);
    expect(d.find((x) => x.level === 1)?.percent).toBe(0);
  });

  it("averages several check-ins of one day", () => {
    const day = new Date(2026, 9, 19, 10);
    const later = new Date(2026, 9, 19, 20);
    const res = dailyAverages(
      [
        { level: 2, created_at: day.toISOString() },
        { level: 5, created_at: later.toISOString() },
      ],
      ["2026-10-19", "2026-10-20"],
    );
    expect(res).toEqual([
      { day: "2026-10-19", avg: 3.5 },
      { day: "2026-10-20", avg: null },
    ]);
  });

  it("colors a day by its most frequent mood", () => {
    expect(
      dominantLevel([
        { level: 1, created_at: "2026-10-19T08:00:00Z" },
        { level: 4, created_at: "2026-10-19T09:00:00Z" },
        { level: 4, created_at: "2026-10-19T07:00:00Z" },
      ]),
    ).toBe(4);
  });

  it("maps old journal moods onto the new scale", () => {
    expect(JOURNAL_MOOD_LEVEL).toEqual({ joy: 5, calm: 4, tired: 3, anxiety: 2, sadness: 1 });
  });
});
