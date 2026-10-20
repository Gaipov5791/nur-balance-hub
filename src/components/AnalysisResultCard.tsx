import { HeartHandshake, Leaf, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { MOOD_LEVELS, moodInfo } from "@/lib/mood";
import type { AnalysisResult } from "@/lib/wallet";

function fmt(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export function AnalysisResultCard({
  result,
  start,
  end,
}: {
  result: AnalysisResult;
  start: string;
  end: string;
}) {
  const total = result.stats.distribution.reduce((a, b) => a + b, 0) || 1;
  const avg = result.stats.avgLevel;
  return (
    <div className="space-y-4">
      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Анализ {fmt(start)} — {fmt(end)}
          </p>
          <span className="text-xs text-muted-foreground">
            {result.stats.checkins} отметок · {result.stats.journal} записей дневника
          </span>
        </div>
        {avg !== null ? (
          <div className="mt-4 flex items-center gap-3">
            <span className={`grid size-12 place-items-center rounded-2xl text-2xl ${moodInfo(avg).soft}`}>
              {moodInfo(avg).emoji}
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl">{avg.toFixed(1)} / 5</p>
              <p className="text-xs text-muted-foreground">Среднее настроение · {moodInfo(avg).label.toLowerCase()}</p>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-secondary">
          {MOOD_LEVELS.map((m, i) => {
            const n = result.stats.distribution[i] ?? 0;
            return n ? (
              <span key={m.level} className={m.bg} style={{ width: `${(n / total) * 100}%` }} title={`${m.label}: ${n}`} />
            ) : null;
          })}
        </div>
        <p className="mt-4 text-sm leading-relaxed">{result.summary}</p>
        {result.moodTrend ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.moodTrend}</p> : null}
      </section>

      {result.emotions.length ? (
        <section className="surface p-5">
          <h3 className="font-display text-base">Заметные эмоции</h3>
          <ul className="mt-3 space-y-3">
            {result.emotions.map((e) => (
              <li key={e.name} className="text-sm">
                <span className="font-semibold">{e.name}</span>
                <span className="block text-muted-foreground">{e.insight}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="surface p-5">
          <h3 className="flex items-center gap-2 font-display text-base">
            <TrendingUp className="size-4 text-primary" /> Что помогает
          </h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
            {result.helps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className="surface p-5">
          <h3 className="flex items-center gap-2 font-display text-base">
            <TrendingDown className="size-4 text-accent" /> Что забирает силы
          </h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
            {result.drains.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="surface p-5">
        <h3 className="flex items-center gap-2 font-display text-base">
          <Leaf className="size-4 text-primary" /> Шаги на ближайшие дни
        </h3>
        <ol className="mt-3 space-y-3">
          {result.recommendations.map((r, i) => (
            <li key={r.title} className="flex gap-3 text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{r.title}</span>
                <span className="block text-muted-foreground">{r.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {result.supportNote ? (
        <section className="surface flex gap-3 border-accent/40 bg-accent/10 p-5 text-sm">
          <HeartHandshake className="mt-0.5 size-5 shrink-0 text-accent" />
          <p className="leading-relaxed">{result.supportNote}</p>
        </section>
      ) : null}
    </div>
  );
}
