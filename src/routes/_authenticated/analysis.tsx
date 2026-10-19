import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Info, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AnalysisProgress, AnalysisView } from "@/components/analysis/AnalysisView";
import { CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { coinKeys, useAnalyses, useCoinWallet, useDeleteAnalysis } from "@/hooks/useCoins";
import { useCheckins } from "@/hooks/useMood";
import { runAnalysis } from "@/lib/analysis.functions";
import {
  ANALYSIS_PERIODS,
  MIN_ANALYSIS_ENTRIES,
  analysisRange,
  analysisRangeLabel,
  formatAnalysisDate,
  periodTitle,
  type AnalysisDto,
  type AnalysisPeriod,
} from "@/lib/analysis";
import { coinsWord, formatRefillIn } from "@/lib/economy";
import { listJournalEntries } from "@/lib/journal.functions";
import { isoDay } from "@/lib/mood";

export const Route = createFileRoute("/_authenticated/analysis")({
  head: () => ({
    meta: [
      { title: "ИИ-анализ настроения — Nur Balance" },
      {
        name: "description",
        content:
          "НурAI разбирает неделю или месяц по отметкам настроения, эмоциям, активностям и дневнику и даёт личные рекомендации.",
      },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<AnalysisPeriod>("week");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<AnalysisDto | null>(null);

  const range = analysisRange(period, isoDay(new Date()));
  const checkins = useCheckins(range.from, range.to);
  const listFn = useServerFn(listJournalEntries);
  const journal = useQuery({ queryKey: ["journal", "list"], queryFn: () => listFn() });
  const wallet = useCoinWallet();
  const history = useAnalyses();
  const remove = useDeleteAnalysis();
  const run = useServerFn(runAnalysis);

  const journalCount = (journal.data ?? []).filter(
    (e) => e.entryDate >= range.from && e.entryDate <= range.to,
  ).length;
  const countReady = !checkins.isPending && !journal.isPending;
  const count = (checkins.data?.length ?? 0) + journalCount;
  const enough = count >= MIN_ANALYSIS_ENTRIES;
  const w = wallet.data;
  const shortBy = w ? Math.max(0, w.analysisCost - w.coins) : 0;

  const refreshCoins = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: coinKeys.all }),
      qc.invalidateQueries({ queryKey: ["profile"] }),
    ]);

  const mutation = useMutation({
    mutationFn: () => run({ data: { period, tzOffset: new Date().getTimezoneOffset() } }),
    onSuccess: async (res) => {
      if (res.ok) {
        setFresh(res.analysis);
        setSelectedId(res.analysis.id);
        toast.success(
          res.analysis.cost > 0
            ? `Анализ готов. Списано ${res.analysis.cost} ${coinsWord(res.analysis.cost)}`
            : "Анализ готов",
        );
      } else if (res.reason === "insufficient") {
        toast.error(`Не хватает коинов: нужно ${res.cost}, у тебя ${res.coins}`);
      } else if (res.reason === "busy") {
        toast.error("Предыдущий анализ ещё готовится. Подожди минуту и обнови страницу");
      } else {
        toast.error(`Нужно хотя бы ${MIN_ANALYSIS_ENTRIES} записи за период. Сейчас: ${res.count}`);
      }
      await refreshCoins();
    },
    onError: async (err) => {
      toast.error(err instanceof Error ? err.message : "Не получилось подготовить анализ");
      await refreshCoins();
    },
  });

  const items = history.data ?? [];
  const shown =
    (selectedId &&
      (items.find((a) => a.id === selectedId) ?? (fresh?.id === selectedId ? fresh : null))) ||
    items[0] ||
    null;

  const onDelete = async (a: AnalysisDto) => {
    if (!confirm(`Удалить анализ «${periodTitle(a)}»?`)) return;
    try {
      await remove.mutateAsync(a.id);
      if (selectedId === a.id) setSelectedId(null);
      if (fresh?.id === a.id) setFresh(null);
      toast.success("Анализ удалён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить анализ");
    }
  };

  const canRun = countReady && enough && !!w && shortBy === 0 && !mutation.isPending;

  return (
    <AppShell title="ИИ-анализ" aside={<CoinsPanel />}>
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="surface p-5 lg:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg">Разбор твоего периода</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                НурAI посмотрит на отметки настроения, эмоции, активности и текст дневника и
                подскажет, что тебя поддерживает, а что забирает силы.
              </p>
            </div>
          </div>

          <div
            className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-secondary/70 p-1"
            role="tablist"
            aria-label="Период"
          >
            {ANALYSIS_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                disabled={mutation.isPending}
                onClick={() => setPeriod(p.id)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  period === p.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-card"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 text-sm">
            <p>
              <span className="text-muted-foreground">Период: </span>
              {analysisRangeLabel(range.from, range.to)}
            </p>
            <p>
              <span className="text-muted-foreground">Записей за период: </span>
              {countReady ? count : "…"}
            </p>
            <p>
              <span className="text-muted-foreground">Стоимость: </span>
              {!w
                ? "…"
                : w.analysisCost === 0
                  ? "бесплатно по подписке (1 анализ в день)"
                  : `${w.analysisCost} 🪙 · на балансе ${w.coins}`}
            </p>
          </div>

          {countReady && !enough ? (
            <div className="mt-4 rounded-2xl bg-secondary p-4 text-sm">
              <p>
                Для анализа нужно хотя бы {MIN_ANALYSIS_ENTRIES} записи за период — отметки
                настроения или записи дневника. Сейчас: {count}.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/mood">
                  <Plus className="size-4" /> Отметить настроение
                </Link>
              </Button>
            </div>
          ) : null}

          {w && shortBy > 0 ? (
            <div className="mt-4 rounded-2xl bg-coin/20 p-4 text-sm">
              <p>
                Не хватает {shortBy} {coinsWord(shortBy)}. Следующее пополнение +{w.refillAmount}{" "}
                {formatRefillIn(w.nextRefillAt, new Date())}.
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-3">
                <Link to="/coins">Купить коины или подписку</Link>
              </Button>
            </div>
          ) : null}

          <Button
            size="lg"
            className="mt-5 w-full"
            disabled={!canRun}
            onClick={() => mutation.mutate()}
          >
            <Sparkles className="size-4" />
            {mutation.isPending
              ? "Готовим анализ…"
              : w?.analysisCost === 0
                ? "Сделать анализ бесплатно"
                : `Сделать анализ · ${w?.analysisCost ?? 15} 🪙`}
          </Button>
        </section>

        {mutation.isPending ? (
          <AnalysisProgress />
        ) : history.isPending ? (
          <Skeleton className="h-72 rounded-3xl" />
        ) : shown ? (
          <AnalysisView analysis={shown} />
        ) : null}

        {items.length > 0 ? (
          <section className="surface p-5">
            <h2 className="font-display text-base">История анализов</h2>
            <ul className="mt-3 space-y-2">
              {items.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left transition-colors ${
                      shown?.id === a.id ? "bg-primary-soft" : "bg-secondary/60 hover:bg-secondary"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{periodTitle(a)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatAnalysisDate(a.createdAt)} · {a.result.summary}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Удалить анализ"
                    disabled={remove.isPending}
                    onClick={() => void onDelete(a)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Анализ готовит ИИ по твоим записям. Это не диагноз и не замена специалисту. Видишь его
          только ты. Если тебе небезопасно — звони 112 или на телефон доверия 150.
        </p>
      </div>
    </AppShell>
  );
}
