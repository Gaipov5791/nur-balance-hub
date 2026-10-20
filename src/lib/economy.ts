/** Single catalog for Nur-Coins. SQL functions in supabase/migrations must stay in sync. */

export const DAILY_COIN_LIMIT = 30;
export const COIN_JOURNAL = 10;
export const COIN_MOOD = 5;
export const COIN_FIRST_ENTRY = 20;
export const COIN_PRACTICE = 5;
export const COIN_BUDDY = 5;
export const COIN_PROFILE = 15;
export const MAX_RECORD_SECONDS = 180;

export const LIMITED_PREFIXES = ["journal_daily", "mood", "practice", "buddy"] as const;

export const STREAK_MILESTONES = [
  { days: 3, bonus: 10, badge: null as string | null },
  { days: 7, bonus: 30, badge: "Неделя заботы" },
  { days: 14, bonus: 50, badge: "Две недели вместе" },
  { days: 30, bonus: 100, badge: "Месяц баланса" },
] as const;

export const STREAK_BONUS: Record<number, number> = Object.fromEntries(
  STREAK_MILESTONES.map((m) => [m.days, m.bonus]),
);

export const coinRules = [
  { emoji: "🎥", text: "Запись видео-дневника", value: "+10", note: "Один раз в день, независимо от длительности" },
  { emoji: "🎯", text: "Эмоция и шкала интенсивности", value: "+5", note: "Если заполнены все поля записи" },
  { emoji: "🧘", text: "Практика из «Ситуативных советов»", value: "+5", note: "За прохождение практики" },
  { emoji: "💬", text: "Разговор с бадди", value: "+5", note: "За первое сообщение за день" },
  { emoji: "🌱", text: "Первая запись после регистрации", value: "+20", note: "Приветственный бонус" },
  { emoji: "👤", text: "Заполнение профиля: цель и статус", value: "+15", note: "Разовый бонус" },
] as const;

export const symbolicRewards = [
  { id: "s1", title: "Тёмная тема", desc: "Мягкое тёмное оформление интерфейса", cost: 50, emoji: "🌌" },
  { id: "s2", title: "Дополнительные иконки настроения", desc: "Больше вариантов, чтобы точнее назвать состояние", cost: 30, emoji: "🎨" },
  { id: "s3", title: "Бейджи за серию дней", desc: "Открываются сами за 7, 14 и 30 дней подряд", cost: 0, emoji: "🏅" },
  { id: "s4", title: "Значок «Все категории советов»", desc: "За прохождение всех категорий практик", cost: 0, emoji: "✨" },
] as const;

export const serviceRewards = [
  { id: "v1", title: "Скидка 10% на первую консультацию", desc: "Психолог из раздела «Психологи»", cost: 150, emoji: "🎟️" },
  { id: "v2", title: "Скидка 20% на консультацию", desc: "Действует на одну сессию", cost: 300, emoji: "🎫" },
  { id: "v3", title: "Бесплатная 15-минутная встреча", desc: "Ознакомительная консультация", cost: 500, emoji: "🤝" },
] as const;

export const rewards = [...symbolicRewards, ...serviceRewards];

export const REWARD_COST: Record<string, number> = Object.fromEntries(rewards.map((r) => [r.id, r.cost]));

export type LimitedAction = "practice" | "buddy";
export type CoinAction = LimitedAction | "profile_complete";

export type PlannedAward = {
  action: string;
  amount: number;
  label: string;
  limited: boolean;
};

export function daysBetween(fromDate: string, toDate: string) {
  const ms = Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

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

function limitedAmount(amount: number, remaining: number) {
  if (remaining <= 0) return 0;
  return Math.min(amount, remaining);
}

export function planJournalAwards(input: {
  day: string;
  done: Set<string>;
  earnedToday: number;
  lastEntryDate: string | null;
  streak: number;
}) {
  let remaining = Math.max(0, DAILY_COIN_LIMIT - input.earnedToday);
  const awards: PlannedAward[] = [];

  const pushLimited = (action: string, amount: number, label: string) => {
    if (input.done.has(action)) return;
    const granted = limitedAmount(amount, remaining);
    if (granted <= 0) return;
    remaining -= granted;
    awards.push({ action, amount: granted, label, limited: true });
  };

  pushLimited(`journal_daily:${input.day}`, COIN_JOURNAL, "Запись дневника");
  pushLimited(`mood:${input.day}`, COIN_MOOD, "Эмоция и интенсивность");

  if (!input.done.has("first_entry")) {
    awards.push({
      action: "first_entry",
      amount: COIN_FIRST_ENTRY,
      label: "Первая запись",
      limited: false,
    });
  }

  const { streak, lastEntryDate } = nextStreak(input.lastEntryDate, input.day, input.streak);
  const bonus = STREAK_BONUS[streak];
  const streakAction = `streak:${streak}`;
  if (bonus && !input.done.has(streakAction)) {
    awards.push({ action: streakAction, amount: bonus, label: `Серия ${streak} дней`, limited: false });
  }

  return {
    awards,
    total: awards.reduce((s, a) => s + a.amount, 0),
    streak,
    lastEntryDate,
  };
}

export function planActionAward(
  action: CoinAction,
  day: string,
  done: Set<string>,
  earnedToday: number,
): { reason: "granted" | "already" | "limit"; award: PlannedAward | null } {
  if (action === "profile_complete") {
    if (done.has("profile_complete")) return { reason: "already", award: null };
    return {
      reason: "granted",
      award: {
        action: "profile_complete",
        amount: COIN_PROFILE,
        label: "Профиль заполнен",
        limited: false,
      },
    };
  }

  const actionId = `${action}:${day}`;
  if (done.has(actionId)) return { reason: "already", award: null };
  const remaining = Math.max(0, DAILY_COIN_LIMIT - earnedToday);
  const amount = limitedAmount(action === "practice" ? COIN_PRACTICE : COIN_BUDDY, remaining);
  if (amount <= 0) return { reason: "limit", award: null };
  return {
    reason: "granted",
    award: {
      action: actionId,
      amount,
      label: action === "practice" ? "Практика выполнена" : "Разговор с бадди",
      limited: true,
    },
  };
}

export function todayLimitedActionIds(day: string) {
  return LIMITED_PREFIXES.map((p) => `${p}:${day}`);
}

export function earnedTodayFrom(rows: { action: string; amount: number }[], day: string) {
  const ids = new Set(todayLimitedActionIds(day));
  return rows.filter((r) => ids.has(r.action)).reduce((s, r) => s + r.amount, 0);
}
