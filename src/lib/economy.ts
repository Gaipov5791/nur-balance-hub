/** Nur-Coin rules. SQL in drizzle/migrations/0002_ai_analyzer_coins.sql and 0003_demo_payments.sql must stay in sync. */

export const MAX_RECORD_SECONDS = 180;

export const REFILL_AMOUNT = 15;
export const REFILL_INTERVAL_DAYS = 3;
export const ANALYSIS_COST = 15;
export const SUBSCRIBER_FREE_ANALYSES_PER_DAY = 1;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const REFILL_INTERVAL_MS = REFILL_INTERVAL_DAYS * DAY_MS;

export function daysBetween(fromDate: string, toDate: string) {
  const ms = Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`);
  return Math.round(ms / DAY_MS);
}

/** Day streak shown on the home screen; one missed day is forgiven. */
export function nextStreak(lastDate: string | null, day: string, current: number) {
  let streak = current;
  if (!lastDate) {
    streak = 1;
  } else {
    const diff = daysBetween(lastDate, day);
    if (diff >= 1 && diff <= 2) streak += 1;
    else if (diff > 2) streak = 1;
  }
  const lastEntryDate = !lastDate || daysBetween(lastDate, day) > 0 ? day : lastDate;
  return { streak, lastEntryDate };
}

/** Mirrors claim_coin_refill(): the first claim pays at once, then +15 per full 3 days, no cap. */
export function planRefill(lastRefillAt: string | null, now: Date) {
  const nowMs = now.getTime();
  if (!lastRefillAt) {
    return {
      granted: REFILL_AMOUNT,
      refilledAt: new Date(nowMs).toISOString(),
      nextRefillAt: new Date(nowMs + REFILL_INTERVAL_MS).toISOString(),
    };
  }
  const last = Date.parse(lastRefillAt);
  const periods = Math.max(0, Math.floor((nowMs - last) / REFILL_INTERVAL_MS));
  const anchor = last + periods * REFILL_INTERVAL_MS;
  return {
    granted: periods * REFILL_AMOUNT,
    refilledAt: new Date(anchor).toISOString(),
    nextRefillAt: new Date(anchor + REFILL_INTERVAL_MS).toISOString(),
  };
}

/** Mirrors start_ai_analysis() pricing: subscribers get one free run per day, then the usual price. */
export function planAnalysisCharge(input: {
  coins: number;
  subscribed: boolean;
  freeUsedToday: boolean;
}) {
  const cost = input.subscribed && !input.freeUsedToday ? 0 : ANALYSIS_COST;
  return { cost, allowed: input.coins >= cost };
}

export function pluralRu(n: number, forms: readonly [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function coinsWord(n: number) {
  return pluralRu(Math.abs(n), ["коин", "коина", "коинов"]);
}

export function nurCoinsLabel(n: number) {
  return `${n} ${pluralRu(Math.abs(n), ["Нур-Коин", "Нур-Коина", "Нур-Коинов"])}`;
}

/** Mirrors create_payment() and ai_daily_limit() in drizzle/migrations/0003_demo_payments.sql. */
export const COIN_PACK = { coins: 230, priceKzt: 1890 } as const;
export const SUBSCRIPTION = { priceKzt: 2150, days: 30 } as const;
export const FREE_AI_DAILY_LIMIT = 30;
export const SUBSCRIBER_AI_DAILY_LIMIT = 100;
export const DEMO_COIN_PACKS_PER_DAY = 3;
/** A subscription can be renewed while at most this many days remain. */
export const SUBSCRIPTION_RENEW_WINDOW_DAYS = 30;

export type Product = "coin_pack" | "subscription_month";

export function aiDailyLimit(subscribed: boolean) {
  return subscribed ? SUBSCRIBER_AI_DAILY_LIMIT : FREE_AI_DAILY_LIMIT;
}

/** Mirrors _fulfill_payment(): an active subscription is extended by 30 days, otherwise it starts now. */
export function planSubscriptionEnd(currentEndsAt: string | null, now: Date) {
  const nowMs = now.getTime();
  const current = currentEndsAt ? Date.parse(currentEndsAt) : Number.NaN;
  const base = Number.isFinite(current) && current > nowMs ? current : nowMs;
  return new Date(base + SUBSCRIPTION.days * DAY_MS).toISOString();
}

/** Mirrors _payment_block_reason(). */
export function purchaseBlockReason(
  product: Product,
  input: { demoPacksToday: number; subscriptionEndsAt: string | null; now: Date },
): "demo_limit" | "too_early" | null {
  if (product === "coin_pack") {
    return input.demoPacksToday >= DEMO_COIN_PACKS_PER_DAY ? "demo_limit" : null;
  }
  const ends = input.subscriptionEndsAt ? Date.parse(input.subscriptionEndsAt) : Number.NaN;
  const windowEnd = input.now.getTime() + SUBSCRIPTION_RENEW_WINDOW_DAYS * DAY_MS;
  return Number.isFinite(ends) && ends > windowEnd ? "too_early" : null;
}

/** "через 2 дня 5 часов", "через 40 минут", "уже сейчас". */
export function formatRefillIn(nextRefillAt: string, now: Date) {
  const left = Date.parse(nextRefillAt) - now.getTime();
  if (!Number.isFinite(left) || left <= 0) return "уже сейчас";
  const days = Math.floor(left / DAY_MS);
  const hours = Math.floor((left % DAY_MS) / HOUR_MS);
  if (days > 0) {
    const d = `${days} ${pluralRu(days, ["день", "дня", "дней"])}`;
    return hours > 0
      ? `через ${d} ${hours} ${pluralRu(hours, ["час", "часа", "часов"])}`
      : `через ${d}`;
  }
  if (hours > 0) return `через ${hours} ${pluralRu(hours, ["час", "часа", "часов"])}`;
  const minutes = Math.max(1, Math.ceil(left / 60_000));
  return `через ${minutes} ${pluralRu(minutes, ["минуту", "минуты", "минут"])}`;
}

const LEGACY_LABELS: Record<string, string> = {
  journal_daily: "Запись дневника",
  mood: "Эмоция в дневнике",
  first_entry: "Первая запись",
  practice: "Практика",
  buddy: "Круг поддержки",
  profile_complete: "Профиль заполнен",
};

/** Human label for a coin_transactions.action. */
export function coinActionLabel(action: string) {
  const [kind = "", rest = ""] = action.split(":");
  if (kind === "refill") return "Пополнение";
  if (kind === "analysis") return "ИИ-анализ";
  if (kind === "refund") return "Возврат за анализ";
  if (kind === "purchase") return "Покупка коинов";
  if (kind === "streak") return `Серия ${rest} дней`;
  return LEGACY_LABELS[kind] ?? "Начисление";
}
