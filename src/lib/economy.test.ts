import { describe, expect, it } from "vitest";
import {
  ANALYSIS_COST,
  COIN_PACK,
  REFILL_AMOUNT,
  SUBSCRIPTION,
  aiDailyLimit,
  coinActionLabel,
  coinsWord,
  daysBetween,
  formatRefillIn,
  nextStreak,
  planAnalysisCharge,
  planRefill,
  planSubscriptionEnd,
  purchaseBlockReason,
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

describe("planRefill", () => {
  const start = "2026-10-01T10:00:00.000Z";

  it("pays 15 coins on the very first claim", () => {
    const now = new Date(start);
    expect(planRefill(null, now)).toEqual({
      granted: REFILL_AMOUNT,
      refilledAt: start,
      nextRefillAt: "2026-10-04T10:00:00.000Z",
    });
    expect(REFILL_AMOUNT).toBe(15);
  });

  it("pays nothing before 3 full days pass", () => {
    const r = planRefill(start, new Date("2026-10-04T09:59:59.000Z"));
    expect(r.granted).toBe(0);
    expect(r.refilledAt).toBe(start);
    expect(r.nextRefillAt).toBe("2026-10-04T10:00:00.000Z");
  });

  it("pays exactly at 3 days and keeps the 3-day rhythm", () => {
    const r = planRefill(start, new Date("2026-10-05T18:00:00.000Z"));
    expect(r.granted).toBe(15);
    expect(r.refilledAt).toBe("2026-10-04T10:00:00.000Z");
    expect(r.nextRefillAt).toBe("2026-10-07T10:00:00.000Z");
  });

  it("pays every missed period without an upper limit", () => {
    const r = planRefill(start, new Date("2026-10-31T10:00:00.000Z"));
    expect(r.granted).toBe(150);
    expect(r.refilledAt).toBe("2026-10-31T10:00:00.000Z");
  });
});

describe("planAnalysisCharge", () => {
  it("costs 15 coins without a subscription", () => {
    expect(planAnalysisCharge({ coins: 15, subscribed: false, freeUsedToday: false })).toEqual({
      cost: ANALYSIS_COST,
      allowed: true,
    });
    expect(ANALYSIS_COST).toBe(15);
  });

  it("refuses when coins are short", () => {
    expect(planAnalysisCharge({ coins: 14, subscribed: false, freeUsedToday: false }).allowed).toBe(
      false,
    );
  });

  it("gives subscribers one free analysis per day, then charges as usual", () => {
    expect(planAnalysisCharge({ coins: 0, subscribed: true, freeUsedToday: false })).toEqual({
      cost: 0,
      allowed: true,
    });
    expect(planAnalysisCharge({ coins: 0, subscribed: true, freeUsedToday: true })).toEqual({
      cost: ANALYSIS_COST,
      allowed: false,
    });
  });
});

describe("purchases", () => {
  const now = new Date("2026-10-19T12:00:00.000Z");

  it("keeps the approved prices", () => {
    expect(COIN_PACK).toEqual({ coins: 230, priceKzt: 1890 });
    expect(SUBSCRIPTION).toEqual({ priceKzt: 2150, days: 30 });
  });

  it("raises the NurAI limit to a quiet 100 for subscribers", () => {
    expect(aiDailyLimit(false)).toBe(30);
    expect(aiDailyLimit(true)).toBe(100);
  });

  it("starts a subscription now for 30 days, or extends an active one", () => {
    expect(planSubscriptionEnd(null, now)).toBe("2026-11-18T12:00:00.000Z");
    expect(planSubscriptionEnd("2026-10-10T00:00:00.000Z", now)).toBe("2026-11-18T12:00:00.000Z");
    expect(planSubscriptionEnd("2026-10-25T12:00:00.000Z", now)).toBe("2026-11-24T12:00:00.000Z");
  });

  it("caps demo coin packs per day", () => {
    const base = { subscriptionEndsAt: null, now };
    expect(purchaseBlockReason("coin_pack", { ...base, demoPacksToday: 2 })).toBeNull();
    expect(purchaseBlockReason("coin_pack", { ...base, demoPacksToday: 3 })).toBe("demo_limit");
  });

  it("allows renewal only within 30 days of the end", () => {
    const base = { demoPacksToday: 0, now };
    expect(
      purchaseBlockReason("subscription_month", { ...base, subscriptionEndsAt: null }),
    ).toBeNull();
    expect(
      purchaseBlockReason("subscription_month", {
        ...base,
        subscriptionEndsAt: "2026-11-18T12:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      purchaseBlockReason("subscription_month", {
        ...base,
        subscriptionEndsAt: "2026-11-18T12:00:01.000Z",
      }),
    ).toBe("too_early");
  });
});

describe("formatRefillIn", () => {
  const now = new Date("2026-10-19T12:00:00.000Z");

  it("formats days, hours and minutes in Russian", () => {
    expect(formatRefillIn("2026-10-21T17:00:00.000Z", now)).toBe("через 2 дня 5 часов");
    expect(formatRefillIn("2026-10-20T12:00:00.000Z", now)).toBe("через 1 день");
    expect(formatRefillIn("2026-10-19T13:30:00.000Z", now)).toBe("через 1 час");
    expect(formatRefillIn("2026-10-19T12:40:00.000Z", now)).toBe("через 40 минут");
    expect(formatRefillIn("2026-10-19T11:00:00.000Z", now)).toBe("уже сейчас");
  });
});

describe("labels", () => {
  it("names ledger actions", () => {
    expect(coinActionLabel("refill:1792420467")).toBe("Пополнение");
    expect(coinActionLabel("analysis:3f2a")).toBe("ИИ-анализ");
    expect(coinActionLabel("refund:3f2a")).toBe("Возврат за анализ");
    expect(coinActionLabel("purchase:3f2a")).toBe("Покупка коинов");
    expect(coinActionLabel("journal_daily:2026-09-10")).toBe("Запись дневника");
    expect(coinActionLabel("streak:7")).toBe("Серия 7 дней");
    expect(coinActionLabel("something")).toBe("Начисление");
  });

  it("pluralizes coins", () => {
    expect(coinsWord(1)).toBe("коин");
    expect(coinsWord(3)).toBe("коина");
    expect(coinsWord(15)).toBe("коинов");
    expect(coinsWord(21)).toBe("коин");
    expect(coinsWord(-15)).toBe("коинов");
  });
});
