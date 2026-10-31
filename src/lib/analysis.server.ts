import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

const RUN_ID = "X-Lovable-AIG-Run-ID";
export const ANALYZER_MODEL = "openai/gpt-6-astra";

const schema = z.object({
  summary: z.string(),
  mood_trend: z.string(),
  emotions: z.array(z.object({ name: z.string(), insight: z.string() })),
  helps: z.array(z.string()),
  drains: z.array(z.string()),
  recommendations: z.array(z.object({ title: z.string(), text: z.string() })),
  support_note: z.string().nullable(),
});
export type AnalyzerOutput = z.infer<typeof schema>;

const INSTRUCTIONS = `Ты — бережный ИИ-анализатор настроения в приложении Nur Balance (Казахстан, русский язык).
Тебе дают записи человека за период: отметки настроения по шкале 1–5 (1 очень плохое, 5 отличное) с эмоциями, активностями и заметками, а также записи дневника: текстовые заметки и расшифровку того, что человек сказал в голосовых и видеозаписях (расшифровка автоматическая, может содержать неточности).
Задача — помочь человеку заметить закономерности, а не ставить диагноз.

Поля ответа:
- summary: 2–4 предложения — общая картина периода.
- mood_trend: 1–3 предложения — как менялось настроение (дни недели, подъёмы, спады).
- emotions: 2–4 самые заметные эмоции, у каждой короткое наблюдение (1–2 предложения).
- helps: 2–4 коротких пункта — что, судя по записям, поднимает настроение (активности, люди, привычки).
- drains: 1–4 коротких пункта — что связано с более низким настроением. Если данных мало — так и скажи одним пунктом.
- recommendations: ровно 3 мягких, конкретных шага на следующую неделю (title до 5 слов, text 1–2 предложения). Можно ссылаться на разделы приложения: «Советы», «Круг поддержки», «Психологи», «Дневник».
- support_note: null, если всё в порядке. Если настроение часто 1–2 или в заметках есть тяжёлые темы — тёплая фраза с предложением обратиться к специалисту в разделе «Психологи». Если есть мысли о самоповреждении, суициде, насилии или опасности — обязательно дай номера Казахстана: 112 (экстренная служба), 103 (скорая), 150 (телефон доверия, бесплатно, круглосуточно), 111 (защита от насилия).

Правила: обращайся на «ты». Пол человека неизвестен: не используй глаголы прошедшего времени и прилагательные в мужском или женском роде о человеке («ты отметил», «ты устала») — переформулируй («в отметке указано», «была отмечена усталость», «тебе было тяжело»). Пиши тепло и просто, без медицинских терминов, диагнозов и лекарств. Опирайся только на данные, не выдумывай события. Не цитируй заметки дословно длинными кусками.`;

export class AnalyzerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AnalyzerError";
  }
}

/** One-shot structured analysis; streamed under the hood, final object awaited server-side. */
export async function runMoodAnalyzer(input: string, signal?: AbortSignal): Promise<AnalyzerOutput> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AnalyzerError("ИИ-анализатор не настроен", 500);
  let runId: string | undefined;
  let status = 0;
  const runFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID)) headers.set(RUN_ID, runId);
    const res = await fetch(url, { ...init, headers });
    runId ??= res.headers.get(RUN_ID)?.trim() || undefined;
    if (!res.ok) status = res.status;
    return res;
  };
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runFetch,
  });
  let streamError: unknown = null;
  const result = streamText({
    model: provider.responses(ANALYZER_MODEL),
    instructions: INSTRUCTIONS,
    prompt: input,
    output: Output.object({ schema }),
    ...(signal ? { abortSignal: signal } : {}),
    maxRetries: 0,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
    onError: ({ error }) => {
      streamError = error;
    },
  });
  try {
    const out = await result.output;
    return out;
  } catch (e) {
    const err = streamError ?? e;
    console.error("mood analyzer failed", status, err instanceof Error ? err.message : err);
    if (status === 429) throw new AnalyzerError("ИИ сейчас перегружен. Попробуй через минуту", 429);
    if (status === 402 || status === 403) throw new AnalyzerError("ИИ-анализ временно недоступен", status);
    if (NoObjectGeneratedError.isInstance(e)) throw new AnalyzerError("ИИ вернул неполный ответ. Попробуй ещё раз", 502);
    throw new AnalyzerError("Не удалось получить анализ. Попробуй ещё раз", status || 500);
  }
}
