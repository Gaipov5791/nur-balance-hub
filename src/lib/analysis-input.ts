import { JOURNAL_MOOD_LEVEL, moodInfo, resolveTag, type Tag } from "@/lib/mood";
import type { AnalysisResult } from "@/lib/wallet";

export type AnalyzerCheckin = { level: number; emotions: string[]; activities: string[]; note: string; created_at: string };
export type AnalyzerJournal = { entry_date: string; mood: string; level: number; note: string };

const JOURNAL_MOOD_LABEL: Record<string, string> = {
  calm: "Спокойствие",
  joy: "Радость",
  anxiety: "Тревога",
  sadness: "Грусть",
  tired: "Усталость",
};

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

function almatyStamp(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Asia/Almaty",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Plain-text prompt for the analyzer: only levels, tags, check-in notes and journal text (no media). */
export function buildAnalyzerInput(input: {
  periodLabel: string;
  start: string;
  end: string;
  checkins: AnalyzerCheckin[];
  journal: AnalyzerJournal[];
  custom?: Map<string, Tag>;
}) {
  const custom = input.custom ?? new Map<string, Tag>();
  const names = (ids: string[]) => ids.map((id) => resolveTag(id, custom).label).join(", ");
  const lines: string[] = [
    `Период: ${input.start} — ${input.end} (${input.periodLabel}).`,
    `Отметок настроения: ${input.checkins.length}. Записей дневника: ${input.journal.length}.`,
    "",
    "Отметки настроения:",
  ];
  const checkins = [...input.checkins].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-150);
  for (const c of checkins) {
    const parts = [`${almatyStamp(c.created_at)} · настроение ${c.level}/5 (${moodInfo(c.level).label})`];
    if (c.emotions.length) parts.push(`эмоции: ${names(c.emotions)}`);
    if (c.activities.length) parts.push(`активности: ${names(c.activities)}`);
    if (c.note.trim()) parts.push(`заметка: «${clip(c.note, 400)}»`);
    lines.push(`- ${parts.join(" · ")}`);
  }
  if (!checkins.length) lines.push("- нет");
  lines.push("", "Видео-дневник (только текст заметок):");
  const journal = [...input.journal].sort((a, b) => a.entry_date.localeCompare(b.entry_date)).slice(-60);
  for (const j of journal) {
    const parts = [`${j.entry_date} · эмоция: ${JOURNAL_MOOD_LABEL[j.mood] ?? j.mood}, интенсивность ${j.level}/5`];
    if (j.note.trim()) parts.push(`заметка: «${clip(j.note, 600)}»`);
    lines.push(`- ${parts.join(" · ")}`);
  }
  if (!journal.length) lines.push("- нет");
  return lines.join("\n");
}

/** Deterministic numbers shown next to the AI text (journal moods mapped onto the 1–5 scale). */
export function analysisStats(checkins: Pick<AnalyzerCheckin, "level">[], journal: Pick<AnalyzerJournal, "mood">[]): AnalysisResult["stats"] {
  const levels = [...checkins.map((c) => c.level), ...journal.map((j) => JOURNAL_MOOD_LEVEL[j.mood] ?? 3)];
  const distribution = [1, 2, 3, 4, 5].map((l) => levels.filter((x) => x === l).length);
  const avg = levels.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : null;
  return {
    entries: checkins.length + journal.length,
    checkins: checkins.length,
    journal: journal.length,
    avgLevel: avg,
    distribution,
  };
}
