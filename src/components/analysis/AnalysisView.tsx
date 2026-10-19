import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  HeartHandshake,
  Loader2,
  Phone,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CRISIS_CONTACTS,
  formatAnalysisDate,
  periodTitle,
  type AnalysisDto,
  type AnalysisResult,
} from "@/lib/analysis";
import { moodLevel } from "@/lib/mood";

const EFFECT = {
  positive: { icon: TrendingUp, className: "bg-mood-4/20 text-foreground", label: "Поддерживало" },
  negative: {
    icon: TrendingDown,
    className: "bg-mood-2/20 text-foreground",
    label: "Забирало силы",
  },
  mixed: { icon: ArrowLeftRight, className: "bg-secondary text-foreground", label: "По-разному" },
} as const;

export function CrisisCard() {
  return (
    <section className="rounded-3xl border border-mood-2/40 bg-mood-2/10 p-5">
      <p className="flex items-center gap-2 font-display text-base">
        <HeartHandshake className="size-5 shrink-0" /> Если сейчас тяжело или небезопасно
      </p>
      <p className="mt-2 text-sm">
        С этим не нужно справляться в одиночку. Позвони — там выслушают и помогут прямо сейчас.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {CRISIS_CONTACTS.map((c) => (
          <li key={c.phone}>
            <a
              href={`tel:${c.phone}`}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 text-sm shadow-soft transition-shadow hover:shadow-lift"
            >
              <Phone className="size-4 shrink-0 text-primary" />
              <span className="font-display text-lg">{c.phone}</span>
              <span className="min-w-0 text-xs text-muted-foreground">{c.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <Button asChild variant="secondary" className="mt-3">
        <Link to="/therapists">Записаться к психологу</Link>
      </Button>
    </section>
  );
}

function StatsStrip({ result }: { result: AnalysisResult }) {
  const { stats } = result;
  const avg = stats.avg === null ? null : moodLevel(stats.avg);
  const levels = stats.levels.filter((l) => l.percent > 0);
  return (
    <div className="rounded-2xl bg-secondary/70 p-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="font-display text-xl">{avg ? `${avg.emoji} ${stats.avg}` : "—"}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {avg ? `среднее · ${avg.label.toLowerCase()}` : "без отметок"}
          </p>
        </div>
        <div>
          <p className="font-display text-xl">{stats.checkins}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">отметок настроения</p>
        </div>
        <div>
          <p className="font-display text-xl">{stats.journal}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">записей дневника</p>
        </div>
      </div>
      {levels.length ? (
        <div
          className="mt-3 flex h-2.5 overflow-hidden rounded-full"
          aria-label="Распределение настроения"
        >
          {levels.map((l) => (
            <span
              key={l.level}
              className={moodLevel(l.level).bg}
              style={{ width: `${l.percent}%` }}
              title={`${moodLevel(l.level).label}: ${l.percent}%`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TagChips({ title, items }: { title: string; items: AnalysisResult["stats"]["emotions"] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span key={t.label} className="rounded-full bg-secondary px-2.5 py-1 text-xs">
            {t.emoji} {t.label} · {t.count}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnalysisView({ analysis }: { analysis: AnalysisDto }) {
  const { result } = analysis;
  return (
    <div className="space-y-5">
      {result.crisis ? <CrisisCard /> : null}
      <section className="surface p-5 lg:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{periodTitle(analysis)}</p>
          <p className="text-xs text-muted-foreground">
            {formatAnalysisDate(analysis.createdAt)} ·{" "}
            {analysis.cost > 0 ? `${analysis.cost} 🪙` : "по подписке"}
          </p>
        </div>
        <div className="mt-4">
          <StatsStrip result={result} />
        </div>

        <h2 className="mt-6 font-display text-lg">Твой период в целом</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{result.summary}</p>

        {result.influences.length ? (
          <>
            <h2 className="mt-6 font-display text-lg">Что влияло на твоё состояние</h2>
            <ul className="mt-3 space-y-2.5">
              {result.influences.map((i) => {
                const e = EFFECT[i.effect];
                return (
                  <li key={i.title} className="flex gap-3 rounded-2xl border border-border p-3.5">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl ${e.className}`}
                      title={e.label}
                    >
                      <e.icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{i.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{i.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {result.recommendations.length ? (
          <>
            <h2 className="mt-6 font-display text-lg">Что можно попробовать</h2>
            <ol className="mt-3 space-y-2.5">
              {result.recommendations.map((r, idx) => (
                <li key={r.title} className="flex gap-3 rounded-2xl bg-primary-soft/70 p-3.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {idx + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{r.title}</span>
                    <span className="mt-0.5 block text-sm">{r.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : null}

        <div className="mt-6 space-y-3">
          <TagChips title="Частые эмоции" items={result.stats.emotions} />
          <TagChips title="Частые активности" items={result.stats.activities} />
        </div>
      </section>
    </div>
  );
}

const STEPS = [
  "Собираем твои записи…",
  "Смотрим, как менялось настроение…",
  "Ищем, что влияло на состояние…",
  "Готовим рекомендации…",
];

export function AnalysisProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="surface flex flex-col items-center p-8 text-center" aria-live="polite">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="mt-4 font-display text-base">{STEPS[step]}</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Обычно это занимает до минуты. Не закрывай страницу — если что-то пойдёт не так, коины
        вернутся на баланс.
      </p>
    </section>
  );
}
