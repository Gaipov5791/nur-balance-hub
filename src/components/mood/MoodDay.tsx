import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoodCheckinForm } from "@/components/mood/MoodCheckinForm";
import { useCustomTags, useDeleteCheckin } from "@/hooks/useMood";
import { dominantLevel, localDayKey, moodInfo, resolveTag, type Checkin, type Tag } from "@/lib/mood";

export function MoodDay({ checkins }: { checkins: Checkin[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [day, setDay] = useState(localDayKey(now));
  const [editing, setEditing] = useState<Checkin | null>(null);
  const [deleting, setDeleting] = useState<Checkin | null>(null);
  const del = useDeleteCheckin();
  const custom = useCustomTags();
  const customMap = useMemo(() => new Map<string, Tag>((custom.data ?? []).map((c) => [c.id, c])), [custom.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, Checkin[]>();
    for (const c of checkins) {
      const k = localDayKey(c.created_at);
      map.set(k, [...(map.get(k) ?? []), c]);
    }
    return map;
  }, [checkins]);

  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const offset = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date(cursor.y, cursor.m, 1));
  const shift = (d: number) => {
    const date = new Date(cursor.y, cursor.m + d, 1);
    setCursor({ y: date.getFullYear(), m: date.getMonth() });
  };
  const todayKey = localDayKey(now);
  const dayItems = byDay.get(day) ?? [];
  const dayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "long" }).format(new Date(`${day}T12:00:00`));

  return (
    <div className="space-y-5">
      <section className="surface p-5 md:p-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Предыдущий месяц">
            <ChevronLeft className="size-5" />
          </Button>
          <p className="font-display text-base first-letter:uppercase">{label}</p>
          <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Следующий месяц">
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted-foreground">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {Array.from({ length: offset }, (_, i) => (
            <span key={`p${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const key = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const items = byDay.get(key) ?? [];
            const lvl = dominantLevel(items);
            const info = lvl ? moodInfo(lvl) : null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDay(key)}
                className={`relative grid aspect-square place-items-center rounded-xl text-sm transition-transform hover:scale-105 ${
                  info ? info.soft : "bg-secondary/60 text-muted-foreground"
                } ${key === day ? "ring-2 ring-primary" : key === todayKey ? "ring-1 ring-primary/50" : ""}`}
                title={info ? `${d} — ${info.label}` : String(d)}
              >
                {info ? <span className="text-lg leading-none">{info.emoji}</span> : d}
                {items.length > 1 ? (
                  <span className="absolute right-0.5 top-0.5 rounded-full bg-card px-1 text-[9px] font-semibold">{items.length}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface p-5 md:p-6">
        <h2 className="font-display text-base first-letter:uppercase">{dayLabel}</h2>
        {dayItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">В этот день отметок нет.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {[...dayItems]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((c) => {
                const info = moodInfo(c.level);
                const tags = [...c.emotions, ...c.activities].map((id) => resolveTag(id, customMap));
                return (
                  <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-full text-xl ${info.bg}`}>{info.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {new Date(c.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · {info.label}
                        </p>
                        {tags.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {tags.map((t) => (
                              <span key={t.id} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                                {t.emoji} {t.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {c.note ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{c.note}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label="Изменить">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(c)} aria-label="Удалить">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Изменить отметку</DialogTitle>
          </DialogHeader>
          {editing ? <MoodCheckinForm editing={editing} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отметку?</AlertDialogTitle>
            <AlertDialogDescription>Запись удалится навсегда, восстановить её не получится.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await del.mutateAsync(deleting.id);
                  toast.success("Отметка удалена");
                } catch {
                  toast.error("Не удалось удалить. Попробуй ещё раз");
                }
                setDeleting(null);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
