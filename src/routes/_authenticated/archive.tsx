import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Lock, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel, MoodCalendar } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { moods } from "@/data/demo";
import { useAuth } from "@/hooks/useAuth";
import { formatTime } from "@/components/VideoRecorder";
import { calendarMonth, formatRuDay } from "@/lib/dates";
import {
  deleteJournalEntry,
  getEntryPlaybackUrl,
  listJournalEntries,
  type JournalEntryDto,
} from "@/lib/journal.functions";
import { archivePinStorageKey, hasJournalPin, verifyJournalPin } from "@/lib/pin";

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({
    meta: [
      { title: "Календарь настроений и архив записей — Nur Balance" },
      {
        name: "description",
        content: "Календарная сетка с иконками настроения и закрытый архив ваших видео-записей.",
      },
      { property: "og:title", content: "Календарь настроений — Nur Balance" },
      {
        property: "og:description",
        content: "Смотрите динамику состояния по дням и пересматривайте свои записи.",
      },
    ],
  }),
  component: ArchivePage,
  errorComponent: ({ error, reset }) => (
    <AppShell title="Календарь и архив">
      <div className="surface p-6 text-center">
        <p className="font-semibold">Архив не загрузился</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-4" onClick={reset}>
          Попробовать снова
        </Button>
      </div>
    </AppShell>
  ),
});

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

function ArchivePage() {
  const { user } = useAuth();
  const listFn = useServerFn(listJournalEntries);
  const pinQuery = useQuery({
    queryKey: ["journal-pin"],
    queryFn: hasJournalPin,
  });
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      setUnlocked(sessionStorage.getItem(archivePinStorageKey(user.id)) === "1");
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const pinReady = pinQuery.isSuccess;
  const locked = pinReady && pinQuery.data === true && !unlocked;
  const entriesQuery = useQuery({
    queryKey: ["journal", "list"],
    queryFn: () => listFn(),
    retry: 2,
    enabled: pinReady && !locked,
  });
  const [active, setActive] = useState<JournalEntryDto | null>(null);

  const entries = entriesQuery.data ?? [];
  const month = calendarMonth();
  const calendarEntries = entries
    .filter((e) => {
      const [y, m] = e.entryDate.split("-").map(Number);
      return y === month.year && m === month.month + 1;
    })
    .map((e) => ({ day: Number(e.entryDate.slice(8, 10)), mood: e.mood, date: formatRuDay(e.entryDate) }));

  const groups = new Map<string, JournalEntryDto[]>();
  for (const e of entries) {
    const arr = groups.get(e.entryDate) ?? [];
    arr.push(e);
    groups.set(e.entryDate, arr);
  }

  return (
    <AppShell title="Календарь и архив" aside={<CoinsPanel />}>
      {!pinReady ? (
        <div className="surface p-6">
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : locked ? (
        <section className="surface mx-auto max-w-md p-6 text-center">
          <Lock className="mx-auto size-8 text-primary" />
          <h2 className="mt-3 font-display text-lg">Архив закрыт PIN-кодом</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Введите 4 цифры, чтобы открыть календарь и записи на этом устройстве.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!user || unlocking) return;
              setUnlocking(true);
              try {
                const ok = await verifyJournalPin(pin);
                if (!ok) {
                  toast.error("Неверный PIN");
                  return;
                }
                try {
                  sessionStorage.setItem(archivePinStorageKey(user.id), "1");
                } catch {
                  /* ignore */
                }
                setUnlocked(true);
                setPin("");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Не удалось проверить PIN");
              } finally {
                setUnlocking(false);
              }
            }}
          >
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="••••"
              className="text-center tracking-[0.4em]"
            />
            <Button type="submit" className="w-full" disabled={pin.length !== 4 || unlocking}>
              {unlocking ? <Loader2 className="size-4 animate-spin" /> : null} Открыть архив
            </Button>
          </form>
        </section>
      ) : (
        <>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <MoodCalendar
          entries={calendarEntries}
          monthLabel={month.monthLabel}
          today={month.today}
          year={month.year}
          month={month.month}
        />

        <section className="surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base">Личный архив</h2>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> видно только вам
            </span>
          </div>

          {entriesQuery.isPending ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : entriesQuery.isError ? (
            <div className="mt-6 rounded-2xl bg-secondary/70 p-6 text-center">
              <p className="font-semibold">Не удалось загрузить записи</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {entriesQuery.error instanceof Error ? entriesQuery.error.message : "Ошибка сети"}
              </p>
              <Button className="mt-4" onClick={() => entriesQuery.refetch()}>
                Повторить
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-secondary/70 p-6 text-center">
              <span className="text-3xl">🎥</span>
              <p className="mt-3 font-semibold">Пока нет записей</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Первая запись принесёт +20 Nur-Coins и начнёт вашу серию дней.
              </p>
              <Button asChild className="mt-4">
                <Link to="/journal">Записать первое видео</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {[...groups.entries()].map(([date, items]) => (
                <div key={date}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatDate(date)}
                  </p>
                  <ul className="space-y-3">
                    {items.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setActive(e)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:bg-secondary/50"
                        >
                          <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-2xl">
                            {e.thumbnailUrl ? (
                              <img
                                src={e.thumbnailUrl}
                                alt=""
                                loading="lazy"
                                className="absolute inset-0 size-full object-cover"
                              />
                            ) : null}
                            <span className={e.thumbnailUrl ? "relative drop-shadow" : ""}>
                              {moods[e.mood].emoji}
                            </span>
                            <span className="absolute inset-0 grid place-items-center bg-foreground/20 text-background opacity-0 transition-opacity hover:opacity-100">
                              <Play className="size-5 fill-current" />
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">
                              {moods[e.mood].label} · {e.level}/5
                            </span>
                            <span className="block truncate text-sm text-muted-foreground">
                              {e.note || "Без заметки"}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatTime(e.durationSeconds)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <PlaybackDialog entry={active} onClose={() => setActive(null)} />
        </>
      )}
    </AppShell>
  );
}

function PlaybackDialog({ entry, onClose }: { entry: JournalEntryDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const playbackFn = useServerFn(getEntryPlaybackUrl);
  const deleteFn = useServerFn(deleteJournalEntry);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const urlQuery = useQuery({
    queryKey: ["journal", "playback", entry?.id],
    enabled: !!entry,
    queryFn: () => playbackFn({ data: { entryId: entry!.id } }),
    staleTime: 50 * 60 * 1000,
    retry: 2,
  });

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { entryId: entry!.id } }),
    onSuccess: () => {
      toast.success("Запись удалена");
      qc.invalidateQueries({ queryKey: ["journal"] });
      setConfirmDelete(false);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Не удалось удалить запись"),
  });

  return (
    <Dialog
      open={!!entry}
      onOpenChange={(o) => {
        if (!o) {
          setConfirmDelete(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {entry ? (
          <>
            <div className="aspect-video bg-foreground/90">
              {urlQuery.isPending ? (
                <div className="grid size-full place-items-center text-background/80">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : urlQuery.isError ? (
                <div className="grid size-full place-items-center p-6 text-center text-background/85">
                  <div>
                    <p className="text-sm">
                      {urlQuery.error instanceof Error ? urlQuery.error.message : "Не удалось открыть видео"}
                    </p>
                    <Button variant="secondary" className="mt-3" onClick={() => urlQuery.refetch()}>
                      Повторить
                    </Button>
                  </div>
                </div>
              ) : (
                <video
                  key={urlQuery.data.url}
                  src={urlQuery.data.url}
                  className="size-full"
                  controls
                  autoPlay
                  playsInline
                  onError={() => toast.error("Видео не воспроизводится в этом браузере")}
                />
              )}
            </div>
            <DialogHeader className="px-5 pt-4 text-left">
              <DialogTitle className="font-display text-base">
                {moods[entry.mood].emoji} {moods[entry.mood].label} · {entry.level}/5
              </DialogTitle>
              <DialogDescription>
                {formatDate(entry.entryDate)} · {formatTime(entry.durationSeconds)}
              </DialogDescription>
            </DialogHeader>
            <div className="px-5 pb-5">
              {entry.note ? <p className="text-sm">{entry.note}</p> : null}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                {confirmDelete ? (
                  <>
                    <span className="text-sm text-muted-foreground">Удалить запись без возможности восстановления?</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Отмена
                    </Button>
                    <Button variant="destructive" size="sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
                      {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Удалить
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="size-4" /> Удалить
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
