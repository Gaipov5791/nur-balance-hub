import type { MoodKey } from "@/data/demo";

/** Mood scale from the spec. Colors are theme tokens `--mood-1..5` in styles.css. */
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export type MoodLevelInfo = {
  level: MoodLevel;
  label: string;
  short: string;
  emoji: string;
  /** Solid fill: dots, rings, selected state. */
  bg: string;
  /** Soft fill: calendar cells, chips. */
  soft: string;
  text: string;
  color: string;
};

export const MOOD_LEVELS: readonly MoodLevelInfo[] = [
  {
    level: 1,
    label: "Очень плохое",
    short: "Очень плохо",
    emoji: "😞",
    bg: "bg-mood-1",
    soft: "bg-mood-1/20",
    text: "text-mood-1",
    color: "var(--mood-1)",
  },
  {
    level: 2,
    label: "Плохое",
    short: "Плохо",
    emoji: "🙁",
    bg: "bg-mood-2",
    soft: "bg-mood-2/20",
    text: "text-mood-2",
    color: "var(--mood-2)",
  },
  {
    level: 3,
    label: "Нормальное",
    short: "Нормально",
    emoji: "😐",
    bg: "bg-mood-3",
    soft: "bg-mood-3/20",
    text: "text-mood-3",
    color: "var(--mood-3)",
  },
  {
    level: 4,
    label: "Хорошее",
    short: "Хорошо",
    emoji: "🙂",
    bg: "bg-mood-4",
    soft: "bg-mood-4/20",
    text: "text-mood-4",
    color: "var(--mood-4)",
  },
  {
    level: 5,
    label: "Отличное",
    short: "Отлично",
    emoji: "😄",
    bg: "bg-mood-5",
    soft: "bg-mood-5/25",
    text: "text-mood-5",
    color: "var(--mood-5)",
  },
];

export function isMoodLevel(value: number): value is MoodLevel {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export function moodLevel(level: number): MoodLevelInfo {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  return MOOD_LEVELS[clamped - 1]!;
}

/** Old journal emotions are not a scale; this keeps the shared calendar colors consistent. */
export const LEGACY_MOOD_LEVEL: Record<MoodKey, MoodLevel> = {
  joy: 5,
  calm: 4,
  tired: 3,
  anxiety: 2,
  sadness: 2,
};

export type TagKind = "emotion" | "activity";
export type CatalogItem = { id: string; label: string; emoji: string };
export type CatalogGroup = { id: string; title: string; items: CatalogItem[] };

export const EMOTION_GROUPS: readonly CatalogGroup[] = [
  {
    id: "joy",
    title: "Радость",
    items: [
      { id: "joy", label: "Радость", emoji: "😊" },
      { id: "delight", label: "Восторг", emoji: "🤩" },
      { id: "calm", label: "Спокойствие", emoji: "😌" },
      { id: "gratitude", label: "Благодарность", emoji: "🙏" },
      { id: "pride", label: "Гордость", emoji: "😎" },
      { id: "inspiration", label: "Вдохновение", emoji: "✨" },
      { id: "relief", label: "Облегчение", emoji: "😮‍💨" },
      { id: "bliss", label: "Блаженство", emoji: "☺️" },
    ],
  },
  {
    id: "love",
    title: "Любовь",
    items: [
      { id: "love", label: "Любовь", emoji: "❤️" },
      { id: "tenderness", label: "Нежность", emoji: "🥰" },
      { id: "in_love", label: "Влюблённость", emoji: "😍" },
      { id: "compassion", label: "Сочувствие", emoji: "🤗" },
      { id: "care", label: "Забота", emoji: "💞" },
      { id: "admiration", label: "Восхищение", emoji: "🌟" },
    ],
  },
  {
    id: "sadness",
    title: "Грусть",
    items: [
      { id: "sadness", label: "Грусть", emoji: "😢" },
      { id: "loneliness", label: "Одиночество", emoji: "🥀" },
      { id: "disappointment", label: "Разочарование", emoji: "😞" },
      { id: "longing", label: "Тоска", emoji: "😔" },
      { id: "resentment", label: "Обида", emoji: "😿" },
      { id: "guilt", label: "Вина", emoji: "😣" },
      { id: "fatigue", label: "Усталость", emoji: "😩" },
    ],
  },
  {
    id: "fear",
    title: "Страх",
    items: [
      { id: "fear", label: "Страх", emoji: "😨" },
      { id: "anxiety", label: "Тревожность", emoji: "😰" },
      { id: "worry", label: "Беспокойство", emoji: "😟" },
      { id: "horror", label: "Ужас", emoji: "😱" },
      { id: "insecurity", label: "Неуверенность", emoji: "😕" },
      { id: "confusion", label: "Растерянность", emoji: "😵‍💫" },
    ],
  },
  {
    id: "anger",
    title: "Гнев",
    items: [
      { id: "anger", label: "Злость", emoji: "😠" },
      { id: "irritation", label: "Раздражение", emoji: "😤" },
      { id: "rage", label: "Ярость", emoji: "😡" },
      { id: "envy", label: "Зависть", emoji: "😒" },
      { id: "indignation", label: "Возмущение", emoji: "🙄" },
      { id: "disgust", label: "Отвращение", emoji: "🤢" },
    ],
  },
  {
    id: "other",
    title: "Другое",
    items: [
      { id: "surprise", label: "Удивление", emoji: "😮" },
      { id: "interest", label: "Интерес", emoji: "🧐" },
      { id: "hope", label: "Надежда", emoji: "🌱" },
      { id: "boredom", label: "Скука", emoji: "🥱" },
      { id: "embarrassment", label: "Смущение", emoji: "😳" },
      { id: "apathy", label: "Апатия", emoji: "😶" },
    ],
  },
];

export const ACTIVITY_GROUPS: readonly CatalogGroup[] = [
  {
    id: "rest",
    title: "Отдых и забота о себе",
    items: [
      { id: "rest", label: "Отдых", emoji: "🛋️" },
      { id: "sleep", label: "Сон", emoji: "😴" },
      { id: "reading", label: "Чтение книги", emoji: "📖" },
      { id: "movie", label: "Фильм или сериал", emoji: "📺" },
      { id: "spa", label: "Ванна, спа", emoji: "🛁" },
      { id: "meditation", label: "Медитация, дыхание", emoji: "🧘" },
      { id: "walk", label: "Прогулка", emoji: "🚶" },
      { id: "journal", label: "Ведение дневника", emoji: "📝" },
      { id: "nature", label: "Природа", emoji: "🌳" },
    ],
  },
  {
    id: "work",
    title: "Работа и учёба",
    items: [
      { id: "work", label: "Работа", emoji: "💼" },
      { id: "study", label: "Учёба", emoji: "📚" },
      { id: "meeting", label: "Рабочая встреча", emoji: "🤝" },
      { id: "chores", label: "Домашние дела", emoji: "🧹" },
      { id: "shopping", label: "Покупки", emoji: "🛒" },
      { id: "commute", label: "Дорога", emoji: "🚌" },
    ],
  },
  {
    id: "social",
    title: "Общение",
    items: [
      { id: "family", label: "Семья", emoji: "👨‍👩‍👧" },
      { id: "friends", label: "Друзья", emoji: "🧑‍🤝‍🧑" },
      { id: "partner", label: "Партнёр", emoji: "💑" },
      { id: "call", label: "Звонок", emoji: "📞" },
      { id: "social_media", label: "Соцсети", emoji: "📱" },
      { id: "party", label: "Праздник", emoji: "🎉" },
    ],
  },
  {
    id: "sport",
    title: "Физическая активность",
    items: [
      { id: "gym", label: "Спорт", emoji: "🏋️" },
      { id: "running", label: "Бег", emoji: "🏃" },
      { id: "yoga", label: "Йога, растяжка", emoji: "🤸" },
      { id: "dance", label: "Танцы", emoji: "💃" },
      { id: "bike", label: "Велосипед", emoji: "🚴" },
      { id: "swim", label: "Плавание", emoji: "🏊" },
    ],
  },
  {
    id: "creative",
    title: "Творчество",
    items: [
      { id: "drawing", label: "Рисование", emoji: "🎨" },
      { id: "music", label: "Музыка", emoji: "🎵" },
      { id: "crafts", label: "Рукоделие", emoji: "🧶" },
      { id: "cooking", label: "Готовка", emoji: "🍳" },
      { id: "photo", label: "Фото", emoji: "📷" },
      { id: "writing", label: "Письмо, тексты", emoji: "✍️" },
    ],
  },
  {
    id: "other",
    title: "Другое",
    items: [
      { id: "health", label: "Здоровье, врач", emoji: "🩺" },
      { id: "therapy", label: "Психологическая практика", emoji: "🗣️" },
      { id: "travel", label: "Поездка", emoji: "✈️" },
      { id: "pet", label: "Питомец", emoji: "🐾" },
      { id: "nothing", label: "Ничего особенного", emoji: "☁️" },
    ],
  },
];

const CATALOG: Record<TagKind, Map<string, CatalogItem>> = {
  emotion: new Map(EMOTION_GROUPS.flatMap((g) => g.items).map((i) => [i.id, i])),
  activity: new Map(ACTIVITY_GROUPS.flatMap((g) => g.items).map((i) => [i.id, i])),
};

export const CUSTOM_PREFIX = "c:";
export const MAX_CUSTOM_LABEL = 40;
export const MAX_NOTE = 1000;
export const MAX_TAGS_PER_KIND = 20;

export type CustomTag = { id: string; kind: TagKind; label: string; emoji: string };

export function customKey(label: string) {
  return `${CUSTOM_PREFIX}${label.trim()}`;
}

/** Stored keys are catalog ids or `c:<label>` for the user's own tags. */
export function resolveTag(
  kind: TagKind,
  key: string,
  custom: readonly CustomTag[] = [],
): CatalogItem {
  if (key.startsWith(CUSTOM_PREFIX)) {
    const label = key.slice(CUSTOM_PREFIX.length);
    const own = custom.find((t) => t.kind === kind && t.label === label);
    return { id: key, label, emoji: own?.emoji || "✨" };
  }
  return CATALOG[kind].get(key) ?? { id: key, label: key, emoji: "✨" };
}

export function normalizeCustomLabel(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_CUSTOM_LABEL);
}

export type Checkin = {
  id: string;
  level: number;
  emotions: string[];
  activities: string[];
  note: string;
  created_at: string;
};

export const MIN_CHECKINS_FOR_STATS = 3;

/** Local calendar date (browser time zone) as YYYY-MM-DD. */
export function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseIsoDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function checkinDay(createdAt: string) {
  return isoDay(new Date(createdAt));
}

export function addDays(iso: string, days: number) {
  const d = parseIsoDay(iso);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

export function daysInRange(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Half-open timestamp range [from 00:00, to+1 00:00) in the browser time zone. */
export function timestampRange(from: string, to: string) {
  return {
    gte: parseIsoDay(from).toISOString(),
    lt: parseIsoDay(addDays(to, 1)).toISOString(),
  };
}

export type StatsPeriod = "week" | "month" | "quarter";

export const STATS_PERIODS: { id: StatsPeriod; label: string }[] = [
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "quarter", label: "3 месяца" },
];

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
const MONTHS_NOM = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function shortDate(iso: string) {
  const d = parseIsoDay(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** Period containing `today`, shifted by `offset` periods (0 = current, -1 = previous). Weeks start on Monday. */
export function periodRange(period: StatsPeriod, offset: number, today: Date) {
  if (period === "week") {
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
    const from = isoDay(monday);
    const to = addDays(from, 6);
    return { from, to, label: `${shortDate(from)} — ${shortDate(to)}` };
  }
  const span = period === "month" ? 1 : 3;
  const lastMonth = new Date(today.getFullYear(), today.getMonth() + offset * span, 1);
  const first = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - (span - 1), 1);
  const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
  const label =
    span === 1
      ? `${MONTHS_NOM[first.getMonth()]} ${first.getFullYear()}`
      : `${MONTHS_NOM[first.getMonth()]} — ${MONTHS_NOM[end.getMonth()]} ${end.getFullYear()}`;
  return { from: isoDay(first), to: isoDay(end), label };
}

export function groupByDay<T extends { created_at: string }>(rows: readonly T[]) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const day = checkinDay(r.created_at);
    const list = map.get(day) ?? [];
    list.push(r);
    map.set(day, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return map;
}

export function averageLevel(rows: readonly { level: number }[]) {
  if (rows.length === 0) return null;
  return rows.reduce((s, r) => s + r.level, 0) / rows.length;
}

export type DailyPoint = { day: string; avg: number | null; count: number };

export function dailyAverages(rows: readonly Checkin[], from: string, to: string): DailyPoint[] {
  const byDay = groupByDay(rows);
  return daysInRange(from, to).map((day) => {
    const list = byDay.get(day) ?? [];
    const avg = averageLevel(list);
    return { day, avg: avg === null ? null : Math.round(avg * 10) / 10, count: list.length };
  });
}

export type LevelShare = { level: MoodLevel; count: number; percent: number };

/** Percent per level; largest-remainder rounding so the total is exactly 100. */
export function levelDistribution(rows: readonly { level: number }[]): LevelShare[] {
  const counts = MOOD_LEVELS.map((m) => ({
    level: m.level,
    count: rows.filter((r) => r.level === m.level).length,
  }));
  const total = counts.reduce((s, c) => s + c.count, 0);
  if (total === 0) return counts.map((c) => ({ ...c, percent: 0 }));
  const raw = counts.map((c) => ({ ...c, exact: (c.count / total) * 100 }));
  const floored = raw.map((c) => ({ ...c, percent: Math.floor(c.exact) }));
  let rest = 100 - floored.reduce((s, c) => s + c.percent, 0);
  const order = [...floored].sort((a, b) => b.exact - b.percent - (a.exact - a.percent));
  for (const c of order) {
    if (rest <= 0) break;
    if (c.count === 0) continue;
    c.percent += 1;
    rest -= 1;
  }
  return floored.map(({ level, count, percent }) => ({ level, count, percent }));
}

export function topTags(rows: readonly Checkin[], field: "emotions" | "activities", limit = 5) {
  const counts = new Map<string, number>();
  for (const r of rows) for (const key of r[field]) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export function formatClock(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** Value for <input type="datetime-local"> in the browser time zone. */
export function toLocalInput(d: Date) {
  return `${isoDay(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
