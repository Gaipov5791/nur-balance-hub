import { MOOD_LEVELS } from "@/lib/mood";

export function MoodLegend({ className = "mt-3" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {MOOD_LEVELS.map((m) => (
        <span
          key={m.level}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${m.soft}`}
        >
          <span className={`size-2.5 rounded-full ${m.bg}`} /> {m.label}
        </span>
      ))}
    </div>
  );
}
