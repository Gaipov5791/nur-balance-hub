/** Nur-Coins v2 (stage B). Amounts are enforced in Postgres (coin_wallet / start_ai_analysis); these mirror them for UI copy. */

export const COIN_REFILL_AMOUNT = 15;
export const COIN_REFILL_DAYS = 3;
export const ANALYSIS_COST = 15;
export const ANALYSIS_MIN_ENTRIES = 3;
export const COIN_PACK = { coins: 230, priceKzt: 1890 } as const;
export const SUBSCRIPTION = { priceKzt: 2150, aiPerDay: 100, freeAnalysesPerDay: 1 } as const;

export type AnalysisPeriod = "week" | "month";
export const ANALYSIS_PERIODS: { id: AnalysisPeriod; label: string; days: number }[] = [
  { id: "week", label: "Неделя", days: 7 },
  { id: "month", label: "Месяц", days: 30 },
];

export type Wallet = {
  coins: number;
  refilled: number;
  refillAmount: number;
  refillEveryDays: number;
  nextRefillAt: string | null;
  analysisCost: number;
  subscriptionActive: boolean;
  subscriptionUntil: string | null;
  freeAnalysisAvailable: boolean;
  aiDailyLimit: number;
};

export function parseWallet(raw: unknown): Wallet {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    coins: Number(o["coins"] ?? 0),
    refilled: Number(o["refilled"] ?? 0),
    refillAmount: Number(o["refill_amount"] ?? COIN_REFILL_AMOUNT),
    refillEveryDays: Number(o["refill_every_days"] ?? COIN_REFILL_DAYS),
    nextRefillAt: str(o["next_refill_at"]),
    analysisCost: Number(o["analysis_cost"] ?? ANALYSIS_COST),
    subscriptionActive: o["subscription_active"] === true,
    subscriptionUntil: str(o["subscription_until"]),
    freeAnalysisAvailable: o["free_analysis_available"] === true,
    aiDailyLimit: Number(o["ai_daily_limit"] ?? 30),
  };
}

/** How an analysis would be paid right now, or why it can't start. Server re-checks everything. */
export function analysisPayment(w: Pick<Wallet, "coins" | "freeAnalysisAvailable">, cost = ANALYSIS_COST) {
  if (w.freeAnalysisAvailable) return { canStart: true, paidWith: "subscription" as const, missing: 0 };
  if (w.coins >= cost) return { canStart: true, paidWith: "coins" as const, missing: 0 };
  return { canStart: false, paidWith: null, missing: cost - w.coins };
}

/** "через 2 дн. 5 ч" style countdown to the next refill. */
export function refillCountdown(nextAt: string | null, now = Date.now()) {
  if (!nextAt) return "";
  const ms = Date.parse(nextAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return "уже скоро";
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  const rest = h % 24;
  if (d > 0) return rest > 0 ? `через ${d} дн. ${rest} ч` : `через ${d} дн.`;
  if (h > 0) return `через ${h} ч`;
  return `через ${Math.max(1, Math.ceil(ms / 60_000))} мин`;
}

export type AnalysisResult = {
  summary: string;
  moodTrend: string;
  emotions: { name: string; insight: string }[];
  helps: string[];
  drains: string[];
  recommendations: { title: string; text: string }[];
  supportNote: string | null;
  stats: { entries: number; checkins: number; journal: number; avgLevel: number | null; distribution: number[] };
};

export type AnalysisRow = {
  id: string;
  period: AnalysisPeriod;
  period_start: string;
  period_end: string;
  entries_count: number;
  paid_with: "coins" | "subscription";
  cost: number;
  status: "pending" | "done" | "failed";
  result: AnalysisResult | null;
  created_at: string;
};
