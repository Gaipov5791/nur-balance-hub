import { z } from "zod";
import { moods, type MoodKey } from "@/data/demo";
import {
  addDays,
  averageLevel,
  levelDistribution,
  moodLevel,
  parseIsoDay,
  resolveTag,
  topTags,
  type Checkin,
  type CustomTag,
  type TagKind,
} from "@/lib/mood";

export type AnalysisPeriod = "week" | "month";

export const ANALYSIS_PERIODS: { id: AnalysisPeriod; label: string; days: number }[] = [
  { id: "week", label: "Неделя", days: 7 },
  { id: "month", label: "Месяц", days: 30 },
];

export const MIN_ANALYSIS_ENTRIES = 3;

export const CRISIS_CONTACTS = [
  { phone: "112", label: "Экстренная служба, круглосуточно" },
  { phone: "103", label: "Скорая помощь" },
  { phone: "150", label: "Телефон доверия, бесплатно и круглосуточно" },
  { phone: "111", label: "Защита от насилия и помощь семьям" },
] as const;

/** Rolling window that ends today: the last 7 or 30 days. */
export function analysisRange(period: AnalysisPeriod, today: string) {
  const days = period === "week" ? 7 : 30;
  return { from: addDays(today, -(days - 1)), to: today };
}

/** `offsetMinutes` is `Date#getTimezoneOffset()` of the user's browser. */
export function localTodayFromOffset(nowMs: number, offsetMinutes: number) {
  return new Date(nowMs - offsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function localDayStartUtc(day: string, offsetMinutes: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + offsetMinutes * 60_000).toISOString();
}

const MONTHS_GEN = [
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

export function analysisRangeLabel(from: string, to: string) {
  const a = parseIsoDay(from);
  const b = parseIsoDay(to);
  return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} — ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
}

export function periodTitle(a: { period: AnalysisPeriod; from: string; to: string }) {
  const label = ANALYSIS_PERIODS.find((p) => p.id === a.period)?.label ?? "Период";
  return `${label} · ${analysisRangeLabel(a.from, a.to)}`;
}

export function formatAnalysisDate(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** What the model must return. Lengths are trimmed in code, not in the schema. */
export const analysisOutputSchema = z.object({
  summary: z.string().describe("Твой период в целом: 3–5 тёплых предложений"),
  influences: z
    .array(
      z.object({
        title: z.string().describe("Коротко, до 6 слов"),
        detail: z.string().describe("1–2 предложения, со ссылкой на данные"),
        effect: z.enum(["positive", "negative", "mixed"]),
      }),
    )
    .describe("Что влияло на состояние: 2–5 пунктов"),
  recommendations: z
    .array(
      z.object({
        title: z.string().describe("Коротко, до 6 слов"),
        detail: z.string().describe("Маленький выполнимый шаг, 1–2 предложения"),
      }),
    )
    .describe("Персональные рекомендации: 3–5 пунктов"),
  crisis: z
    .boolean()
    .describe(
      "true, если в текстах есть признаки самоповреждения, суицидальных мыслей, насилия или острой опасности",
    ),
});

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

const tagStatSchema = z.object({ label: z.string(), emoji: z.string(), count: z.number() });

const storedSchema = analysisOutputSchema.extend({
  stats: z.object({
    checkins: z.number(),
    journal: z.number(),
    avg: z.number().nullable(),
    levels: z.array(z.object({ level: z.number(), percent: z.number() })),
    emotions: z.array(tagStatSchema),
    activities: z.array(tagStatSchema),
  }),
});

export type AnalysisResult = z.infer<typeof storedSchema>;
export type AnalysisStats = AnalysisResult["stats"];

export function parseAnalysisResult(value: unknown): AnalysisResult | null {
  const parsed = storedSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type JournalForAnalysis = { entry_date: string; mood: string; level: number; note: string };

function tagStats(
  rows: Checkin[],
  field: "emotions" | "activities",
  kind: TagKind,
  custom: readonly CustomTag[],
) {
  return topTags(rows, field, 5).map(({ key, count }) => {
    const t = resolveTag(kind, key, custom);
    return { label: t.label, emoji: t.emoji, count };
  });
}

export function computeAnalysisStats(
  checkins: Checkin[],
  journal: readonly JournalForAnalysis[],
  custom: readonly CustomTag[],
): AnalysisStats {
  const avg = averageLevel(checkins);
  return {
    checkins: checkins.length,
    journal: journal.length,
    avg: avg === null ? null : Math.round(avg * 10) / 10,
    levels: levelDistribution(checkins).map((s) => ({ level: s.level, percent: s.percent })),
    emotions: tagStats(checkins, "emotions", "emotion", custom),
    activities: tagStats(checkins, "activities", "activity", custom),
  };
}

const CRISIS_PATTERNS = [
  /суицид/,
  /поконч\S* с собой/,
  /(убить|убью|убиваю) себя/,
  /не (хочу|хочется) жить/,
  /жить не (хочу|хочется)/,
  /нет смысла жить/,
  /(хочу|хочется) умереть/,
  /лучше бы меня не было/,
  /(навредить|навред\S*) себе/,
  /причин\S* себе (вред|боль)/,
  /(порезать|режу|резать) себя/,
  /самоповрежд/,
  /наглотаться таблеток/,
  /меня (бьют|бьет|избивает|избивают)/,
  /насили/,
];

/** Safety net next to the model's own flag: any match shows crisis contacts. */
export function detectCrisisSignals(texts: readonly string[]) {
  return texts.some((raw) => {
    const t = raw.toLowerCase().replace(/ё/g, "е");
    return CRISIS_PATTERNS.some((p) => p.test(t));
  });
}

function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function localStamp(createdAt: string, offsetMinutes: number) {
  const d = new Date(Date.parse(createdAt) - offsetMinutes * 60_000).toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)} ${d.slice(11, 16)}`;
}

const MAX_PROMPT_CHECKINS = 150;
const MAX_PROMPT_JOURNAL = 40;
const MAX_NOTE_CHARS = 400;

export function buildAnalysisPrompt(input: {
  period: AnalysisPeriod;
  from: string;
  to: string;
  offsetMinutes: number;
  checkins: Checkin[];
  journal: readonly JournalForAnalysis[];
  custom: readonly CustomTag[];
  stats: AnalysisStats;
}) {
  const { stats } = input;
  const lines: string[] = [];
  const periodName = input.period === "week" ? "последние 7 дней" : "последние 30 дней";
  lines.push(`Период: ${periodName} (${analysisRangeLabel(input.from, input.to)}).`);
  lines.push(
    `Отметок настроения: ${stats.checkins}. Записей дневника: ${stats.journal}.` +
      (stats.avg === null
        ? ""
        : ` Среднее настроение: ${stats.avg} из 5 (${moodLevel(stats.avg).label.toLowerCase()}).`),
  );
  if (stats.checkins > 0) {
    lines.push(
      "Распределение настроения: " +
        stats.levels.map((l) => `${moodLevel(l.level).label} — ${l.percent}%`).join(", ") +
        ".",
    );
  }
  if (stats.emotions.length) {
    lines.push(
      `Частые эмоции: ${stats.emotions.map((t) => `${t.label} (${t.count})`).join(", ")}.`,
    );
  }
  if (stats.activities.length) {
    lines.push(
      `Частые активности: ${stats.activities.map((t) => `${t.label} (${t.count})`).join(", ")}.`,
    );
  }

  const checkins = input.checkins.slice(-MAX_PROMPT_CHECKINS);
  if (checkins.length) {
    lines.push("", "Отметки настроения (шкала 1–5, по времени):");
    for (const c of checkins) {
      const parts = [
        `${localStamp(c.created_at, input.offsetMinutes)} · ${moodLevel(c.level).label} (${c.level})`,
      ];
      const emotions = c.emotions.map((k) => resolveTag("emotion", k, input.custom).label);
      const activities = c.activities.map((k) => resolveTag("activity", k, input.custom).label);
      if (emotions.length) parts.push(`эмоции: ${emotions.join(", ")}`);
      if (activities.length) parts.push(`активности: ${activities.join(", ")}`);
      if (c.note.trim()) parts.push(`заметка: «${clip(c.note, MAX_NOTE_CHARS)}»`);
      lines.push(`- ${parts.join(" · ")}`);
    }
  }

  const journal = input.journal.slice(-MAX_PROMPT_JOURNAL);
  if (journal.length) {
    lines.push("", "Видео-дневник (эмоция дня и её сила 1–5):");
    for (const j of journal) {
      const mood = moods[j.mood as MoodKey]?.label ?? j.mood;
      const d = j.entry_date;
      const parts = [`${d.slice(8, 10)}.${d.slice(5, 7)} · ${mood}, сила ${j.level}/5`];
      if (j.note.trim()) parts.push(`текст: «${clip(j.note, MAX_NOTE_CHARS)}»`);
      lines.push(`- ${parts.join(" · ")}`);
    }
  }
  return lines.join("\n");
}

const LIMITS = { summary: 1200, title: 80, detail: 400, influences: 5, recommendations: 5 };

export function finalizeAnalysis(
  output: AnalysisOutput,
  stats: AnalysisStats,
  crisisSignals: boolean,
): AnalysisResult {
  return {
    summary: clip(output.summary, LIMITS.summary),
    influences: output.influences
      .filter((i) => i.title.trim() && i.detail.trim())
      .slice(0, LIMITS.influences)
      .map((i) => ({
        ...i,
        title: clip(i.title, LIMITS.title),
        detail: clip(i.detail, LIMITS.detail),
      })),
    recommendations: output.recommendations
      .filter((r) => r.title.trim() && r.detail.trim())
      .slice(0, LIMITS.recommendations)
      .map((r) => ({ title: clip(r.title, LIMITS.title), detail: clip(r.detail, LIMITS.detail) })),
    crisis: output.crisis || crisisSignals,
    stats,
  };
}

export type AnalysisDto = {
  id: string;
  period: AnalysisPeriod;
  from: string;
  to: string;
  cost: number;
  createdAt: string;
  result: AnalysisResult;
};
