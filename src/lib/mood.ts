/** Mood tracker catalog and pure helpers. Colors come from --mood-1..5 tokens in styles.css. */

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export const MOOD_LEVELS: { level: MoodLevel; label: string; emoji: string; bg: string; soft: string; text: string; color: string }[] = [
  { level: 1, label: "Очень плохое", emoji: "😞", bg: "bg-mood-1", soft: "bg-mood-1/25", text: "text-mood-1", color: "var(--mood-1)" },
  { level: 2, label: "Плохое", emoji: "😟", bg: "bg-mood-2", soft: "bg-mood-2/25", text: "text-mood-2", color: "var(--mood-2)" },
  { level: 3, label: "Нормальное", emoji: "😐", bg: "bg-mood-3", soft: "bg-mood-3/25", text: "text-mood-3", color: "var(--mood-3)" },
  { level: 4, label: "Хорошее", emoji: "😊", bg: "bg-mood-4", soft: "bg-mood-4/25", text: "text-mood-4", color: "var(--mood-4)" },
  { level: 5, label: "Отличное", emoji: "😄", bg: "bg-mood-5", soft: "bg-mood-5/30", text: "text-mood-5", color: "var(--mood-5)" },
];

export function moodInfo(level: number) {
  const i = Math.min(5, Math.max(1, Math.round(level))) - 1;
  return MOOD_LEVELS[i]!;
}

/** Old journal moods mapped onto the 5-level scale so every calendar uses one palette. */
export const JOURNAL_MOOD_LEVEL: Record<string, MoodLevel> = {
  joy: 5,
  calm: 4,
  tired: 3,
  anxiety: 2,
  sadness: 1,
};

export type Tag = { id: string; label: string; emoji: string };
export type TagGroup = { title: string; items: Tag[] };

const t = (id: string, label: string, emoji: string): Tag => ({ id, label, emoji });

export const EMOTION_GROUPS: TagGroup[] = [
  { title: "Радость", items: [t("joy", "Радость", "😊"), t("bliss", "Блаженство", "😌"), t("gratitude", "Благодарность", "🙏"), t("pride", "Гордость", "🥲"), t("delight", "Восхищение", "🤩"), t("inspiration", "Вдохновение", "✨")] },
  { title: "Любовь", items: [t("love", "Любовь", "❤️"), t("tenderness", "Нежность", "🥰"), t("empathy", "Сочувствие", "🤗"), t("charm", "Очарованность", "💗"), t("care", "Забота", "💞")] },
  { title: "Спокойствие", items: [t("calm", "Спокойствие", "🌿"), t("relief", "Облегчение", "😮‍💨"), t("confidence", "Уверенность", "💪")] },
  { title: "Грусть", items: [t("sadness", "Грусть", "😢"), t("loneliness", "Одиночество", "🫥"), t("disappointment", "Разочарование", "😞"), t("longing", "Тоска", "🌧️")] },
  { title: "Страх", items: [t("fear", "Страх", "😨"), t("anxiety", "Тревожность", "😰"), t("worry", "Беспокойство", "😟"), t("confusion", "Растерянность", "😵‍💫")] },
  { title: "Гнев", items: [t("anger", "Злость", "😠"), t("irritation", "Раздражение", "😤"), t("resentment", "Обида", "😒"), t("envy", "Зависть", "😑")] },
  { title: "Другое", items: [t("tired", "Усталость", "🥱"), t("boredom", "Скука", "😶"), t("shame", "Стыд", "😳"), t("guilt", "Вина", "😔"), t("surprise", "Удивление", "😮")] },
];

export const ACTIVITY_GROUPS: TagGroup[] = [
  { title: "Отдых и забота о себе", items: [t("rest", "Отдых", "🛋️"), t("sleep", "Сон", "😴"), t("reading", "Чтение", "📖"), t("movie", "Фильм или сериал", "🎬"), t("spa", "Ванна, спа", "🛁"), t("walk", "Прогулка", "🚶"), t("meditation", "Медитация, дыхание", "🧘"), t("journal", "Дневник", "📝"), t("nature", "Природа", "🌳")] },
  { title: "Работа и учёба", items: [t("work", "Работа", "💼"), t("meeting", "Рабочая встреча", "👥"), t("study", "Учёба", "🎓"), t("chores", "Домашние дела", "🧹"), t("shopping", "Покупки", "🛍️")] },
  { title: "Общение", items: [t("family", "Семья", "👨‍👩‍👧"), t("friends", "Друзья", "🫶"), t("partner", "Партнёр", "💑"), t("call", "Звонок", "📞"), t("social", "Соцсети", "📱")] },
  { title: "Физическая активность", items: [t("sport", "Спорт", "🏃"), t("yoga", "Йога", "🧘‍♀️"), t("dance", "Танцы", "💃"), t("bike", "Велосипед", "🚴")] },
  { title: "Творчество", items: [t("music", "Музыка", "🎵"), t("drawing", "Рисование", "🎨"), t("cooking", "Готовка", "🍳"), t("handmade", "Рукоделие", "🧶")] },
  { title: "Другое", items: [t("travel", "Поездка", "🚗"), t("therapy", "Психолог", "💬"), t("health", "Здоровье, врач", "🩺"), t("pray", "Молитва", "🤲")] },
];

const builtIn = new Map<string, Tag>(
  [...EMOTION_GROUPS, ...ACTIVITY_GROUPS].flatMap((g) => g.items.map((i) => [i.id, i] as const)),
);

/** Built-in ids are plain; custom tags are stored as `c:<label>` with their emoji resolved from custom_tags. */
export function resolveTag(id: string, custom: Map<string, Tag>): Tag {
  return builtIn.get(id) ?? custom.get(id) ?? { id, label: id.startsWith("c:") ? id.slice(2) : id, emoji: "✨" };
}

export const customTagId = (label: string) => `c:${label.trim()}`;

export type Checkin = {
  id: string;
  level: number;
  emotions: string[];
  activities: string[];
  note: string;
  created_at: string;
};

/** Validation shared by the form: a check-in needs a mood level; note is optional. */
export function canSaveCheckin(input: { level: number | null }) {
  return input.level !== null && input.level >= 1 && input.level <= 5;
}

export const MIN_STATS_ENTRIES = 3;

export function localDayKey(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Percent of each mood level over the given check-ins; rounded, sums may differ from 100 by rounding. */
export function moodDistribution(items: Pick<Checkin, "level">[]) {
  const total = items.length;
  return MOOD_LEVELS.map((m) => {
    const count = items.filter((i) => i.level === m.level).length;
    return { level: m.level, count, percent: total ? Math.round((count / total) * 100) : 0 };
  });
}

/** Average mood per local day, in chronological order, for the given list of day keys. */
export function dailyAverages(items: Pick<Checkin, "level" | "created_at">[], days: string[]) {
  const byDay = new Map<string, number[]>();
  for (const i of items) {
    const k = localDayKey(i.created_at);
    byDay.set(k, [...(byDay.get(k) ?? []), i.level]);
  }
  return days.map((day) => {
    const levels = byDay.get(day);
    const avg = levels ? levels.reduce((a, b) => a + b, 0) / levels.length : null;
    return { day, avg: avg === null ? null : Math.round(avg * 10) / 10 };
  });
}

export function topTags(items: Pick<Checkin, "emotions" | "activities">[], kind: "emotions" | "activities", limit = 5) {
  const counts = new Map<string, number>();
  for (const i of items) for (const id of i[kind]) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id, count]) => ({ id, count }));
}

/** Most frequent level of a day (ties → the latest check-in's level). Used for calendar colors. */
export function dominantLevel(items: Pick<Checkin, "level" | "created_at">[]) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const counts = new Map<number, number>();
  for (const i of sorted) counts.set(i.level, (counts.get(i.level) ?? 0) + 1);
  let best = sorted[0]!.level;
  for (const i of sorted) if ((counts.get(i.level) ?? 0) > (counts.get(best) ?? 0)) best = i.level;
  return best;
}

export type StatsPeriod = "week" | "month" | "quarter";
export const PERIOD_DAYS: Record<StatsPeriod, number> = { week: 7, month: 30, quarter: 90 };

export function lastDays(count: number, now = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (count - 1 - i));
    return localDayKey(d);
  });
}
