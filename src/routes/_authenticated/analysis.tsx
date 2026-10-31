import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { Button } from "@/components/ui/button";
import { useAnalyses, useWallet } from "@/hooks/useWallet";
import { runAnalysis } from "@/lib/analysis.functions";
import {
  ANALYSIS_COST,
  ANALYSIS_MIN_ENTRIES,
  ANALYSIS_PERIODS,
  analysisPayment,
  refillCountdown,
  type AnalysisPeriod,
  type AnalysisRow,
} from "@/lib/wallet";

export const Route = createFileRoute("/_authenticated/analysis")({
  head: () => ({
    meta: [
      { title: "ИИ-анализ настроения — Nur Balance" },
      {
        name: "description",
        content: "ИИ-анализ твоих отметок настроения, эмоций, активностей и дневника за неделю или месяц: закономерности и мягкие шаги.",
      },
      { property: "og:title", content: "ИИ-анализ настроения — Nur Balance" },
      { property: "og:description", content: "Узнай, что поднимает настроение и что забирает силы — по твоим записям за неделю или месяц." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalysisPage,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function AnalysisPage() {
  const [period, setPeriod] = useState<AnalysisPeriod>("week");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<AnalysisRow | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const wallet = useWallet();
  const history = useAnalyses();
  const run = useServerFn(runAnalysis);
  const qc = useQueryClient();

  const w = wallet.data;
  const pay = w ? analysisPayment(w, w.analysisCost) : null;

  const start = async () => {
    if (running) return;
    setRunning(true);
    setProblem(null);
    try {
      const res = await run({ data: { period } });
      if (res.ok) {
        setCurrent(res.analysis);
        toast.success("Анализ готов");
      } else {
        setProblem(res.message);
      }
    } catch {
      setProblem("Не удалось связаться с сервером. Проверь интернет и попробуй ещё раз.");
    } finally {
      setRunning(false);
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["ai-analyses"] });
    }
  };

  const past = (history.data ?? []).filter((a) => a.id !== current?.id && a.result);

  return (
    <AppShell title="ИИ-анализ настроения">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="surface p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Что покажет анализ
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            ИИ прочитает твои отметки настроения, эмоции, активности и текст дневника за выбранный период и подскажет,
            что поднимает настроение, что забирает силы и какие шаги могут помочь. Это не диагноз, а взгляд со стороны.
          </p>

          <div className="mt-4 flex gap-2 rounded-full bg-secondary p-1">
            {ANALYSIS_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                disabled={running}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  period === p.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/70 p-4 text-sm">
            <span className="min-w-0">
              {wallet.isPending ? (
                "Проверяем баланс…"
              ) : wallet.isError ? (
                <>Не удалось загрузить баланс. <button className="underline" onClick={() => wallet.refetch()}>Повторить</button></>
              ) : pay?.paidWith === "subscription" ? (
                "Сегодняшний анализ входит в подписку"
              ) : (
                <>
                  Стоимость — <b>{w?.analysisCost ?? ANALYSIS_COST} 🪙</b> · у тебя {w?.coins ?? 0} 🪙
                </>
              )}
            </span>
            <Button onClick={() => void start()} disabled={running || !pay?.canStart}>
              {running ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Анализируем…
                </>
              ) : pay?.paidWith === "subscription" ? (
                "Сделать анализ"
              ) : (
                `Сделать анализ · ${w?.analysisCost ?? ANALYSIS_COST} 🪙`
              )}
            </Button>
          </div>
          {w && pay && !pay.canStart ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Не хватает {pay.missing} 🪙. Следующие +{w.refillAmount} 🪙 придут {refillCountdown(w.nextRefillAt)}.{" "}
              <Link to="/rewards" className="text-primary underline">
                Подробнее о монетах
              </Link>
            </p>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Нужно минимум {ANALYSIS_MIN_ENTRIES} записи за период. ИИ учитывает текст, а также речь из голосовых и видеозаписей.
          </p>
          {running ? (
            <p className="mt-3 text-sm text-primary">НурAI изучает твои записи — обычно это занимает до минуты.</p>
          ) : null}
          {problem ? (
            <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
              {problem}
              {problem.includes("3 записи") ? (
                <Button asChild size="sm" variant="outline" className="ml-2 mt-2">
                  <Link to="/mood">Отметить настроение</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        {current?.result ? (
          <AnalysisResultCard result={current.result} start={current.period_start} end={current.period_end} />
        ) : null}

        <section className="surface p-5">
          <h2 className="font-display text-base">Прошлые анализы</h2>
          {history.isPending ? (
            <p className="mt-2 text-sm text-muted-foreground">Загружаем…</p>
          ) : history.isError ? (
            <p className="mt-2 text-sm">
              Не удалось загрузить.{" "}
              <button className="underline" onClick={() => history.refetch()}>
                Повторить
              </button>
            </p>
          ) : past.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Здесь появятся твои анализы. Их видишь только ты.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {past.map((a) => (
                <li key={a.id} className="rounded-2xl border border-border">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left text-sm"
                    onClick={() => setOpenId(openId === a.id ? null : a.id)}
                  >
                    <span className="font-medium">
                      {a.period === "week" ? "Неделя" : "Месяц"} · {fmtDate(a.created_at)}
                    </span>
                    <span className="text-muted-foreground">{openId === a.id ? "Свернуть" : "Открыть"}</span>
                  </button>
                  {openId === a.id && a.result ? (
                    <div className="border-t border-border p-3">
                      <AnalysisResultCard result={a.result} start={a.period_start} end={a.period_end} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
