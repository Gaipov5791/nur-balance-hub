import { useMemo, useState } from "react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCustomTags } from "@/hooks/useMood";
import {
  dailyAverages,
  lastDays,
  MIN_STATS_ENTRIES,
  moodDistribution,
  moodInfo,
  MOOD_LEVELS,
  PERIOD_DAYS,
  resolveTag,
  topTags,
  type Checkin,
  type StatsPeriod,
  type Tag,
} from "@/lib/mood";

const PERIODS: { id: StatsPeriod; label: string }[] = [
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "quarter", label: "3 месяца" },
];

export function MoodStats({ checkins }: { checkins: Checkin[] }) {
  const [period, setPeriod] = useState<StatsPeriod>("week");
  const custom = useCustomTags();
  const customMap = useMemo(() => new Map<string, Tag>((custom.data ?? []).map((c) => [c.id, c])), [custom.data]);

  const days = useMemo(() => lastDays(PERIOD_DAYS[period]), [period]);
  const items = useMemo(() => {
    const from = new Date(`${days[0]}T00:00:00`).getTime();
    return checkins.filter((c) => new Date(c.created_at).getTime() >= from);
  }, [checkins, days]);
  const series = useMemo(
    () => dailyAverages(items, days).map((d) => ({ ...d, label: `${d.day.slice(8)}.${d.day.slice(5, 7)}` })),
    [items, days],
  );
  const dist = moodDistribution(items);
  const top = dist.reduce((a, b) => (b.count > a.count ? b : a), dist[0]!);
  const enough = items.length >= MIN_STATS_ENTRIES;

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-full bg-secondary p-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              period === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!enough ? (
        <section className="surface p-6 text-center">
          <p className="text-3xl">🌱</p>
          <p className="mt-2 font-display text-base">Пока мало данных</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Нужно хотя бы {MIN_STATS_ENTRIES} отметки за выбранный период, чтобы показать график. Сейчас: {items.length}.
          </p>
        </section>
      ) : (
        <>
          <section className="surface p-5 md:p-6">
            <h2 className="font-display text-base">Среднее настроение</h2>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer>
                <LineChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    interval={period === "week" ? 0 : period === "month" ? 4 : 14}
                  />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 14 }} tickFormatter={(v: number) => moodInfo(v).emoji} />
                  <Tooltip
                    formatter={(v) => [typeof v === "number" ? `${v} — ${moodInfo(v).label}` : "—", "Настроение"]}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    connectNulls
                    dot={(props: { cx?: number; cy?: number; payload?: { avg: number | null; day: string } }) => {
                      const { cx, cy, payload } = props;
                      if (cx == null || cy == null || payload?.avg == null) return <g key={payload?.day} />;
                      return <circle key={payload.day} cx={cx} cy={cy} r={5} fill={moodInfo(payload.avg).color} stroke="var(--card)" strokeWidth={2} />;
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="surface p-5 md:p-6">
            <h2 className="font-display text-base">Распределение настроения</h2>
            <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
              <div className="relative size-44 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={dist.filter((d) => d.count > 0)} dataKey="count" nameKey="level" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                      {dist
                        .filter((d) => d.count > 0)
                        .map((d) => (
                          <Cell key={d.level} fill={moodInfo(d.level).color} />
                        ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="font-display text-2xl">{top.percent}%</p>
                    <p className="text-xs text-muted-foreground">{moodInfo(top.level).label}</p>
                  </div>
                </div>
              </div>
              <ul className="w-full space-y-2">
                {[...MOOD_LEVELS].reverse().map((m) => {
                  const d = dist.find((x) => x.level === m.level)!;
                  return (
                    <li key={m.level} className="flex items-center gap-3 text-sm">
                      <span className={`size-3 shrink-0 rounded-full ${m.bg}`} />
                      <span className="min-w-0 flex-1">
                        {m.emoji} {m.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{d.percent}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Всего отметок за период: {items.length}</p>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <TopList title="Частые эмоции" items={topTags(items, "emotions")} customMap={customMap} />
            <TopList title="Частые активности" items={topTags(items, "activities")} customMap={customMap} />
          </div>
        </>
      )}
    </div>
  );
}

function TopList({ title, items, customMap }: { title: string; items: { id: string; count: number }[]; customMap: Map<string, Tag> }) {
  return (
    <section className="surface p-5">
      <h3 className="font-display text-base">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Пока не отмечено.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((i) => {
            const t = resolveTag(i.id, customMap);
            return (
              <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {t.emoji} {t.label}
                </span>
                <span className="shrink-0 text-muted-foreground">{i.count}×</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
