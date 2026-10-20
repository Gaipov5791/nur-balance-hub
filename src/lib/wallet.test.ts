import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analysisStats } from "@/lib/analysis-input";
import { ANALYSIS_COST, analysisPayment, COIN_PACK, COIN_REFILL_AMOUNT, COIN_REFILL_DAYS, SUBSCRIPTION } from "@/lib/wallet";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sql = readFileSync(join(root, "drizzle/migrations/0002_ai_analyzer_coins.sql"), "utf8");
const fix = readFileSync(join(root, "drizzle/migrations/0003_ai_analysis_start_order_fix.sql"), "utf8");

describe("Nur-Coins v2 rules", () => {
  it("refills +15 coins every 3 days without a cap", () => {
    expect(COIN_REFILL_AMOUNT).toBe(15);
    expect(COIN_REFILL_DAYS).toBe(3);
    expect(sql).toContain("/ 259200"); // 3 days in seconds
    expect(sql).toContain("amount := periods * 15");
  });

  it("charges 15 coins per analysis and needs at least 3 entries", () => {
    expect(ANALYSIS_COST).toBe(15);
    expect(fix).toContain("IF entries < 3 THEN");
    expect(fix).toContain("price := 15");
  });

  it("subscription gives one free analysis per day and NurAI 100/day (30 without)", () => {
    expect(SUBSCRIPTION.priceKzt).toBe(2150);
    expect(sql).toContain("WHEN public.has_active_subscription(_user_id) THEN 100 ELSE 30");
    expect(fix).toContain("pay := 'subscription'");
  });

  it("coin pack is 230 coins for 1 890 ₸", () => {
    expect(COIN_PACK).toEqual({ coins: 230, priceKzt: 1890 });
  });

  it("old earning grants nothing and the shop is closed", () => {
    expect(sql).toContain("'awards', '[]'::jsonb, 'total', 0");
    expect(sql).toContain("RAISE EXCEPTION 'Магазин наград закрыт'");
  });

  it("only the server can complete or refund an analysis", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.complete_ai_analysis(uuid, jsonb) FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fail_ai_analysis(uuid, text) FROM PUBLIC, anon, authenticated");
  });
});

describe("analysisPayment", () => {
  it("uses the subscription first, then 15 coins", () => {
    expect(analysisPayment({ coins: 0, freeAnalysisAvailable: true }).paidWith).toBe("subscription");
    expect(analysisPayment({ coins: 15, freeAnalysisAvailable: false }).paidWith).toBe("coins");
    expect(analysisPayment({ coins: 14, freeAnalysisAvailable: false })).toEqual({ canStart: false, paidWith: null, missing: 1 });
  });
});

describe("analysisStats", () => {
  it("maps journal moods onto the 1–5 scale", () => {
    const s = analysisStats([{ level: 5 }, { level: 1 }], [{ mood: "calm" }]);
    expect(s.entries).toBe(3);
    expect(s.distribution).toEqual([1, 0, 0, 1, 1]);
    expect(s.avgLevel).toBe(3.3);
  });
});
