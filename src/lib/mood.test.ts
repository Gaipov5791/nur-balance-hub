import { describe, expect, it } from "vitest";
import {
  ACTIVITY_GROUPS,
  EMOTION_GROUPS,
  LEGACY_MOOD_LEVEL,
  MOOD_LEVELS,
  customKey,
  dailyAverages,
  levelDistribution,
  moodLevel,
  normalizeCustomLabel,
  periodRange,
  resolveTag,
  topTags,
  type Checkin,
} from "@/lib/mood";

function at(day: string, hour: number, level: number, extra: Partial<Checkin> = {}): Checkin {
  const [y, m, d] = day.split("-").map(Number);
  return {
    id: `${day}-${hour}`,
    level,
    emotions: [],
    activities: [],
    note: "",
    created_at: new Date(y!, m! - 1, d!, hour).toISOString(),
    ...extra,
  };
}

describe("mood scale", () => {
  it("matches the spec colors and order", () => {
    expect(MOOD_LEVELS.map((m) => [m.level, m.label, m.emoji])).toEqual([
      [1, "Очень плохое", "😞"],
      [2, "Плохое", "🙁"],
      [3, "Нормальное", "😐"],
      [4, "Хорошее", "🙂"],
      [5, "Отличное", "😄"],
    ]);
    expect(MOOD_LEVELS.map((m) => m.color)).toEqual([1, 2, 3, 4, 5].map((n) => `var(--mood-${n})`));
  });

  it("rounds and clamps averages to a level", () => {
    expect(moodLevel(3.4).level).toBe(3);
    expect(moodLevel(3.5).level).toBe(4);
    expect(moodLevel(0).level).toBe(1);
    expect(moodLevel(9).level).toBe(5);
  });

  it("maps every old journal emotion", () => {
    expect(Object.keys(LEGACY_MOOD_LEVEL).sort()).toEqual([
      "anxiety",
      "calm",
      "joy",
      "sadness",
      "tired",
    ]);
  });
});

describe("catalogs", () => {
  it("have the categories from the spec and unique ids", () => {
    expect(EMOTION_GROUPS.map((g) => g.title)).toEqual([
      "Радость",
      "Любовь",
      "Грусть",
      "Страх",
      "Гнев",
      "Другое",
    ]);
    expect(ACTIVITY_GROUPS.map((g) => g.title)).toEqual([
      "Отдых и забота о себе",
      "Работа и учёба",
      "Общение",
      "Физическая активность",
      "Творчество",
      "Другое",
    ]);
    for (const groups of [EMOTION_GROUPS, ACTIVITY_GROUPS]) {
      const ids = groups.flatMap((g) => g.items.map((i) => i.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("resolves catalog and custom tags", () => {
    expect(resolveTag("emotion", "joy")).toMatchObject({ label: "Радость", emoji: "😊" });
    const custom = [{ id: "1", kind: "emotion" as const, label: "Ностальгия", emoji: "📼" }];
    expect(resolveTag("emotion", customKey(" Ностальгия "), custom)).toMatchObject({
      label: "Ностальгия",
      emoji: "📼",
    });
    expect(resolveTag("activity", customKey("Шахматы"))).toMatchObject({
      label: "Шахматы",
      emoji: "✨",
    });
  });

  it("normalizes custom labels", () => {
    expect(normalizeCustomLabel("  Мой   вариант ")).toBe("Мой вариант");
    expect(normalizeCustomLabel("а".repeat(60))).toHaveLength(40);
  });
});

describe("periodRange", () => {
  const today = new Date(2026, 9, 21); // Wed 21 Oct 2026

  it("weeks start on Monday", () => {
    expect(periodRange("week", 0, today)).toMatchObject({ from: "2026-10-19", to: "2026-10-25" });
    expect(periodRange("week", -1, today)).toMatchObject({ from: "2026-10-12", to: "2026-10-18" });
  });

  it("months and three-month windows end with the current month", () => {
    expect(periodRange("month", 0, today)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
      label: "Октябрь 2026",
    });
    expect(periodRange("month", -10, today)).toMatchObject({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    expect(periodRange("quarter", 0, today)).toMatchObject({
      from: "2026-08-01",
      to: "2026-10-31",
    });
    expect(periodRange("quarter", -1, today)).toMatchObject({
      from: "2026-05-01",
      to: "2026-07-31",
    });
  });
});

describe("aggregations", () => {
  const rows = [
    at("2026-10-19", 9, 2),
    at("2026-10-19", 20, 5, { emotions: ["joy", "calm"], activities: ["walk"] }),
    at("2026-10-21", 12, 4, { emotions: ["joy"], activities: ["walk", "work"] }),
  ];

  it("averages per day and leaves empty days null", () => {
    expect(dailyAverages(rows, "2026-10-19", "2026-10-21")).toEqual([
      { day: "2026-10-19", avg: 3.5, count: 2 },
      { day: "2026-10-20", avg: null, count: 0 },
      { day: "2026-10-21", avg: 4, count: 1 },
    ]);
  });

  it("distribution sums to exactly 100", () => {
    const shares = levelDistribution(rows);
    expect(shares.reduce((s, x) => s + x.percent, 0)).toBe(100);
    expect(shares.find((s) => s.level === 1)?.percent).toBe(0);
    expect(levelDistribution([]).every((s) => s.percent === 0)).toBe(true);
  });

  it("ranks frequent tags", () => {
    expect(topTags(rows, "emotions")).toEqual([
      { key: "joy", count: 2 },
      { key: "calm", count: 1 },
    ]);
    expect(topTags(rows, "activities", 1)).toEqual([{ key: "walk", count: 2 }]);
  });
});
