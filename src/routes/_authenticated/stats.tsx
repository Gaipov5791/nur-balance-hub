import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Info, Plus } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { MoodLegend } from "@/components/mood/MoodLegend";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCheckins, useCustomTags } from "@/hooks/useMood";
import { formatRuDay } from "@/lib/dates";
import {
  MIN_CHECKINS_FOR_STATS,
  STATS_PERIODS,
  dailyAverages,
  levelDistribution,
  moodLevel,
  parseIsoDay,
  periodRange,
  resolveTag,
  topTags,
  type Checkin,
  type CustomTag,
  type DailyPoint,
  type StatsPeriod,
  type TagKind,
} from "@/lib/mood";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({
    meta: [
      { title: "Статистика настроения — Nur Balance" },
      {
        name: "description",
        content:
          "Как менялось настроение за неделю, месяц или 3 месяца: график, проценты, частые эмоции и активности.",
      },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const [period, setPeriod] = useState<StatsPeriod>("week");
  const [offset, setOffset] = useState(0);
  const range = periodRange(period, offset, new Date());
  const q = useCheckins(range.from, range.to);
  const tags = useCustomTags();
  const rows = q.data ?? [];

  return (
    <AppShell title="Статистика">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="surface p-2">
          <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Период">
            {STATS_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                onClick={() => {
                  setPeriod(p.id);
                  setOffset(0);
                }}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  period === p.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOffset((o) => o - 1)}
              aria-label="Раньше"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <p className="text-sm font-medium">{range.label}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset === 0}
              aria-label="Позже"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>

        {q.isPending ? (
          <>
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </>
        ) : q.isError ? (
          <div className="surface p-6 text-center">
            <p className="text-sm">{q.error.message}</p>
            <Button className="mt-3" variant="secondary" onClick={() => void q.refetch()}>
              Повторить
            </Button>
          </div>
        ) : rows.length < MIN_CHECKINS_FOR_STATS ? (
          <NotEnoughData count={rows.length} />
        ) : (
          <StatsBody
            rows={rows}
            from={range.from}
            to={range.to}
            period={period}
            custom={tags.data ?? []}
          />
        )}

        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Статистика показывает только твои отметки и не является оценкой психологического
          состояния. Видишь её только ты.
        </p>
      </div>
    </AppShell>
  );
}

function NotEnoughData({ count }: { count: number }) {
  return (
    <div className="surface p-6 text-center">
      <span className="text-4xl">📈</span>
      <p className="mt-3 font-display text-base">Пока мало отметок для статистики</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Графики появятся, когда за выбранный период будет хотя бы {MIN_CHECKINS_FOR_STATS} отметки.
        Сейчас: {count}.
      </p>
      <Button asChild className="mt-4">
        <Link to="/mood">
          <Plus className="size-4" /> Отметить настроение
        </Link>
      </Button>
    </div>
  );
}

function axisLabel(day: string, period: StatsPeriod) {
  const d = parseIsoDay(day);
  return period === "quarter"
    ? `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`
    : String(d.getDate());
}

function StatsBody({
  rows,
  from,
  to,
  period,
  custom,
}: {
  rows: Checkin[];
  from: string;
  to: string;
  period: StatsPeriod;
  custom: readonly CustomTag[];
}) {
  const points = dailyAverages(rows, from, to).map((p) => ({
    ...p,
    label: axisLabel(p.day, period),
  }));
  const shares = levelDistribution(rows);
  const top = [...shares].sort((a, b) => b.count - a.count || b.level - a.level)[0]!;
  const topMood = moodLevel(top.level);
  const nonEmpty = shares.filter((s) => s.count > 0);

  return (
    <>
      <section className="surface p-5">
        <h2 className="font-display text-base">Среднее настроение</h2>
        <p className="mt-1 text-xs text-muted-foreground">По дням, всего отметок: {rows.length}</p>
        <div className="mt-4 h-60 w-full">
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                width={30}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 14 }}
                tickFormatter={(v: number) => moodLevel(v).emoji}
              />
              <Tooltip content={<PointTooltip />} />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="var(--primary)"
                strokeOpacity={0.45}
                strokeWidth={2.5}
                connectNulls
                isAnimationActive={false}
                dot={(props: {
                  cx?: number | null;
                  cy?: number | null;
                  index?: number;
                  payload?: DailyPoint;
                }) => {
                  const avg = props.payload?.avg;
                  if (props.cx == null || props.cy == null || avg == null)
                    return <g key={props.index} />;
                  return (
                    <circle
                      key={props.index}
                      cx={props.cx}
                      cy={props.cy}
                      r={5}
                      fill={moodLevel(avg).color}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="font-display text-base">Распределение настроения</h2>
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative size-44 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={nonEmpty}
                  dataKey="count"
                  nameKey="level"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={nonEmpty.length > 1 ? 2 : 0}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {nonEmpty.map((s) => (
                    <Cell key={s.level} fill={moodLevel(s.level).color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="font-display text-2xl">{top.percent}%</p>
                <p className="text-xs text-muted-foreground">{topMood.label}</p>
              </div>
            </div>
          </div>
          <ul className="w-full flex-1 space-y-2">
            {[...shares].reverse().map((s) => {
              const m = moodLevel(s.level);
              return (
                <li key={s.level} className="flex items-center gap-3 text-sm">
                  <span className={`size-3 shrink-0 rounded-full ${m.bg}`} />
                  <span className="shrink-0">{m.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{m.label}</span>
                  <span className="tabular-nums text-muted-foreground">{s.count}</span>
                  <span className="w-11 text-right font-semibold tabular-nums">{s.percent}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <TopList
          title="Частые эмоции"
          kind="emotion"
          items={topTags(rows, "emotions")}
          custom={custom}
        />
        <TopList
          title="Частые активности"
          kind="activity"
          items={topTags(rows, "activities")}
          custom={custom}
        />
      </div>
      <MoodLegend className="px-1" />
    </>
  );
}

function PointTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: DailyPoint }[];
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-soft">
      <p className="font-semibold">{formatRuDay(p.day)}</p>
      {p.avg === null ? (
        <p className="text-muted-foreground">Нет отметок</p>
      ) : (
        <p>
          {moodLevel(p.avg).emoji} {moodLevel(p.avg).label} · среднее {p.avg} · отметок: {p.count}
        </p>
      )}
    </div>
  );
}

function TopList({
  title,
  kind,
  items,
  custom,
}: {
  title: string;
  kind: TagKind;
  items: { key: string; count: number }[];
  custom: readonly CustomTag[];
}) {
  const max = items[0]?.count ?? 1;
  return (
    <section className="surface p-5">
      <h2 className="font-display text-base">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">За этот период не отмечены.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((i) => {
            const t = resolveTag(kind, i.key, custom);
            return (
              <li key={i.key} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="shrink-0">{t.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                  <span className="tabular-nums text-muted-foreground">{i.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${(i.count / max) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
