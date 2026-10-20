import { describe, expect, it } from "vitest";
import {
  COIN_BUDDY,
  COIN_FIRST_ENTRY,
  COIN_JOURNAL,
  COIN_MOOD,
  COIN_PRACTICE,
  COIN_PROFILE,
  DAILY_COIN_LIMIT,
  daysBetween,
  earnedTodayFrom,
  nextStreak,
  planActionAward,
  planJournalAwards,
  REWARD_COST,
  rewards,
  STREAK_BONUS,
} from "@/lib/economy";

describe("daysBetween", () => {
  it("counts calendar days in UTC", () => {
    expect(daysBetween("2026-09-10", "2026-09-11")).toBe(1);
    expect(daysBetween("2026-09-10", "2026-09-12")).toBe(2);
    expect(daysBetween("2026-09-10", "2026-09-10")).toBe(0);
    expect(daysBetween("2026-09-11", "2026-09-10")).toBe(-1);
  });
});

describe("nextStreak", () => {
  it("starts at 1 with no previous entry", () => {
    expect(nextStreak(null, "2026-09-10", 0)).toEqual({ streak: 1, lastEntryDate: "2026-09-10" });
  });

  it("increments for the next day and forgives one missed day", () => {
    expect(nextStreak("2026-09-09", "2026-09-10", 4).streak).toBe(5);
    expect(nextStreak("2026-09-08", "2026-09-10", 4).streak).toBe(5);
  });

  it("resets after two missed days and keeps streak on a backdated entry", () => {
    expect(nextStreak("2026-09-07", "2026-09-10", 4).streak).toBe(1);
    expect(nextStreak("2026-09-11", "2026-09-10", 4)).toEqual({
      streak: 4,
      lastEntryDate: "2026-09-11",
    });
  });
});

describe("planJournalAwards", () => {
  it("grants journal, mood and first-entry bonuses", () => {
    const result = planJournalAwards({
      day: "2026-09-10",
      done: new Set(),
      earnedToday: 0,
      lastEntryDate: null,
      streak: 0,
    });
    expect(result.total).toBe(COIN_JOURNAL + COIN_MOOD + COIN_FIRST_ENTRY);
    expect(result.awards.map((a) => a.action)).toEqual([
      "journal_daily:2026-09-10",
      "mood:2026-09-10",
      "first_entry",
    ]);
    expect(result.streak).toBe(1);
  });

  it("caps limited awards at the daily limit and still pays first-entry", () => {
    const result = planJournalAwards({
      day: "2026-09-10",
      done: new Set(),
      earnedToday: 28,
      lastEntryDate: null,
      streak: 0,
    });
    expect(result.awards.find((a) => a.action.startsWith("journal_daily"))?.amount).toBe(2);
    expect(result.awards.some((a) => a.action.startsWith("mood:"))).toBe(false);
    expect(result.awards.find((a) => a.action === "first_entry")?.amount).toBe(COIN_FIRST_ENTRY);
  });

  it("adds a streak milestone once", () => {
    const result = planJournalAwards({
      day: "2026-09-10",
      done: new Set(["first_entry"]),
      earnedToday: 0,
      lastEntryDate: "2026-09-09",
      streak: 6,
    });
    expect(result.streak).toBe(7);
    expect(result.awards.some((a) => a.action === "streak:7" && a.amount === STREAK_BONUS[7])).toBe(
      true,
    );
  });

  it("does not double-pay completed actions", () => {
    const result = planJournalAwards({
      day: "2026-09-10",
      done: new Set(["journal_daily:2026-09-10", "mood:2026-09-10", "first_entry"]),
      earnedToday: 15,
      lastEntryDate: "2026-09-10",
      streak: 1,
    });
    expect(result.awards).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("planActionAward", () => {
  it("grants a one-time profile bonus", () => {
    const result = planActionAward("profile_complete", "2026-09-10", new Set(), 0);
    expect(result.reason).toBe("granted");
    expect(result.award?.amount).toBe(COIN_PROFILE);
  });

  it("respects already and daily limit for practice/buddy", () => {
    expect(planActionAward("practice", "2026-09-10", new Set(["practice:2026-09-10"]), 0).reason).toBe(
      "already",
    );
    expect(planActionAward("buddy", "2026-09-10", new Set(), DAILY_COIN_LIMIT).reason).toBe("limit");
    expect(planActionAward("practice", "2026-09-10", new Set(), 0).award?.amount).toBe(COIN_PRACTICE);
    expect(planActionAward("buddy", "2026-09-10", new Set(), 0).award?.amount).toBe(COIN_BUDDY);
  });
});

describe("earnedTodayFrom", () => {
  it("sums only limited actions for that day", () => {
    expect(
      earnedTodayFrom(
        [
          { action: "journal_daily:2026-09-10", amount: 10 },
          { action: "first_entry", amount: 20 },
          { action: "practice:2026-09-09", amount: 5 },
        ],
        "2026-09-10",
      ),
    ).toBe(10);
  });
});

describe("reward catalog", () => {
  it("matches the SQL catalog ids and costs", () => {
    expect(REWARD_COST).toEqual({
      s1: 50,
      s2: 30,
      s3: 0,
      s4: 0,
      v1: 150,
      v2: 300,
      v3: 500,
    });
    expect(rewards.map((r) => r.id)).toEqual(["s1", "s2", "s3", "s4", "v1", "v2", "v3"]);
  });
});
