import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DailyQuestion = { id: string; bank: "daily" | "self" | "psych"; topic: string; text: string };

export const BANK_LABEL: Record<DailyQuestion["bank"], string> = {
  daily: "Вопрос дня",
  self: "Узнай себя",
  psych: "Взгляд внутрь",
};

/** Sunday → self-discovery, Wednesday → psychological, other days → daily bank. */
export function bankForDate(d: Date): DailyQuestion["bank"] {
  const wd = d.getDay();
  if (wd === 0) return "self";
  if (wd === 3) return "psych";
  return "daily";
}

function dayNumber(d: Date) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** Deterministic: the same question for everyone on a given local date. */
export function pickQuestion(all: DailyQuestion[], d: Date): DailyQuestion | null {
  const bank = bankForDate(d);
  const pool = all.filter((q) => q.bank === bank);
  const list = pool.length ? pool : all;
  if (!list.length) return null;
  const n = dayNumber(d);
  // Count only matching weekdays so consecutive same-bank days rotate.
  const idx = bank === "daily" ? n : Math.floor(n / 7);
  return list[((idx % list.length) + list.length) % list.length] ?? null;
}

export function useQuestionBank() {
  return useQuery({
    queryKey: ["daily-questions"],
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<DailyQuestion[]> => {
      const { data, error } = await supabase
        .from("daily_questions")
        .select("id, bank, topic, text")
        .eq("active", true)
        .order("sort");
      if (error) throw error;
      return (data ?? []) as DailyQuestion[];
    },
  });
}

export function useDailyQuestion(date: Date = new Date()) {
  const q = useQuestionBank();
  return { ...q, question: q.data ? pickQuestion(q.data, date) : null };
}
