import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarClock, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { TagBadges, TagPicker } from "@/components/mood/TagPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCheckin, useCustomTags, useSaveCheckin } from "@/hooks/useMood";
import {
  ACTIVITY_GROUPS,
  EMOTION_GROUPS,
  MAX_NOTE,
  MOOD_LEVELS,
  checkinDay,
  isMoodLevel,
  toLocalInput,
  type CustomTag,
  type MoodLevel,
} from "@/lib/mood";

export const Route = createFileRoute("/_authenticated/mood")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { id?: string | undefined; level?: MoodLevel | undefined } => {
    const level = Number(search["level"]);
    return {
      id: typeof search["id"] === "string" ? (search["id"] as string) : undefined,
      level: isMoodLevel(level) ? level : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Отметить настроение — Nur Balance" },
      {
        name: "description",
        content: "Быстрая отметка настроения, эмоций и активностей с заметкой — за 10–15 секунд.",
      },
    ],
  }),
  component: MoodPage,
});

const STEPS = ["Настроение", "Эмоции", "Активности", "Сохранить запись"] as const;
type Step = 0 | 1 | 2 | 3;

function MoodPage() {
  const { id, level } = Route.useSearch();
  const existing = useCheckin(id);

  if (id && existing.isPending) {
    return (
      <AppShell title="Отметка настроения">
        <div className="surface mx-auto max-w-2xl p-6">
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (id && !existing.data) {
    return (
      <AppShell title="Отметка настроения">
        <div className="surface mx-auto max-w-2xl p-6 text-center">
          <p className="font-semibold">Отметка не найдена</p>
          <p className="mt-1 text-sm text-muted-foreground">Возможно, она уже удалена.</p>
          <Button asChild className="mt-4">
            <Link to="/my-day">Открыть «Мой день»</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <MoodWizard key={id ?? "new"} editId={id} initial={existing.data ?? null} startLevel={level} />
  );
}

function MoodWizard({
  editId,
  initial,
  startLevel,
}: {
  editId?: string | undefined;
  initial: {
    level: number;
    emotions: string[];
    activities: string[];
    note: string;
    created_at: string;
  } | null;
  startLevel?: MoodLevel | undefined;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const tags = useCustomTags();
  const save = useSaveCheckin();
  const savingRef = useRef(false);

  const [step, setStep] = useState<Step>(initial ? 3 : startLevel ? 1 : 0);
  const [level, setLevel] = useState<MoodLevel | null>(
    initial && isMoodLevel(initial.level) ? initial.level : (startLevel ?? null),
  );
  const [emotions, setEmotions] = useState<string[]>(initial?.emotions ?? []);
  const [activities, setActivities] = useState<string[]>(initial?.activities ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [when, setWhen] = useState(() =>
    toLocalInput(initial ? new Date(initial.created_at) : new Date()),
  );
  const [maxWhen, setMaxWhen] = useState(() => toLocalInput(new Date()));

  useEffect(() => {
    const t = setInterval(() => setMaxWhen(toLocalInput(new Date())), 30_000);
    return () => clearInterval(t);
  }, []);

  const custom = tags.data ?? [];

  const back = () => {
    if (step > 0) setStep((s) => (s - 1) as Step);
    else router.history.back();
  };

  const submit = async () => {
    if (savingRef.current) return;
    if (!level) {
      toast.error("Сначала выбери настроение");
      setStep(0);
      return;
    }
    const date = new Date(when);
    if (Number.isNaN(date.getTime())) {
      toast.error("Проверь дату и время");
      return;
    }
    if (date.getTime() > Date.now() + 60_000) {
      toast.error("Нельзя сохранить отметку в будущем");
      return;
    }
    savingRef.current = true;
    try {
      await save.mutateAsync({
        id: editId,
        draft: { level, emotions, activities, note, createdAt: date.toISOString() },
      });
      toast.success(editId ? "Запись обновлена" : "Запись сохранена", {
        description: "Она уже в «Мой день» и в статистике",
      });
      await navigate({ to: "/my-day", search: { day: checkinDay(date.toISOString()) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить отметку");
    } finally {
      savingRef.current = false;
    }
  };

  return (
    <AppShell title={editId ? "Изменить отметку" : "Отметка настроения"}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={back} aria-label="Назад">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              Шаг {step + 1} из {STEPS.length}
            </p>
            <h2 className="truncate font-display text-lg">{STEPS[step]}</h2>
          </div>
        </div>
        <div className="mb-5 grid grid-cols-4 gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>

        <section className="surface p-5 lg:p-6">
          {step === 0 ? (
            <MoodStep
              value={level}
              onPick={(l) => {
                setLevel(l);
                if (!initial) setStep(1);
              }}
            />
          ) : step === 1 ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Отметь, что ты чувствуешь сейчас. Можно выбрать несколько.
              </p>
              <TagPicker
                kind="emotion"
                groups={EMOTION_GROUPS}
                custom={custom}
                value={emotions}
                onChange={setEmotions}
              />
            </>
          ) : step === 2 ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Какие занятия были у тебя сегодня? Можно выбрать несколько.
              </p>
              <TagPicker
                kind="activity"
                groups={ACTIVITY_GROUPS}
                custom={custom}
                value={activities}
                onChange={setActivities}
              />
            </>
          ) : (
            <SummaryStep
              level={level}
              emotions={emotions}
              activities={activities}
              custom={custom}
              note={note}
              onNote={setNote}
              when={when}
              maxWhen={maxWhen}
              onWhen={setWhen}
              onEdit={setStep}
            />
          )}
        </section>

        <div className="sticky bottom-24 z-10 mt-4 flex gap-2 lg:bottom-4">
          {step === 1 || step === 2 ? (
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Пропустить
            </Button>
          ) : null}
          {step < 3 ? (
            <Button
              size="lg"
              className="flex-1"
              disabled={step === 0 && !level}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Далее
            </Button>
          ) : (
            <Button
              size="lg"
              className="flex-1"
              disabled={save.isPending}
              onClick={() => void submit()}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {editId ? "Сохранить изменения" : "Сохранить"}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MoodStep({ value, onPick }: { value: MoodLevel | null; onPick: (l: MoodLevel) => void }) {
  return (
    <div>
      <h3 className="text-center font-display text-xl">Как твоё настроение сейчас?</h3>
      <div className="mt-6 grid grid-cols-5 gap-2 sm:gap-3">
        {MOOD_LEVELS.map((m) => {
          const selected = value === m.level;
          return (
            <button
              key={m.level}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(m.level)}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-2 py-3 transition-all sm:p-3 ${
                selected
                  ? "border-foreground/70 shadow-lift"
                  : "border-transparent hover:-translate-y-0.5"
              } ${m.soft}`}
            >
              <span
                className={`grid size-12 place-items-center rounded-full text-3xl sm:size-14 ${m.bg}`}
              >
                {m.emoji}
              </span>
              <span className="text-center text-[11px] font-medium leading-tight sm:text-xs">
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        Здесь нет правильных ответов — просто отметь, как есть.
      </p>
    </div>
  );
}

function SummaryStep({
  level,
  emotions,
  activities,
  custom,
  note,
  onNote,
  when,
  maxWhen,
  onWhen,
  onEdit,
}: {
  level: MoodLevel | null;
  emotions: string[];
  activities: string[];
  custom: readonly CustomTag[];
  note: string;
  onNote: (v: string) => void;
  when: string;
  maxWhen: string;
  onWhen: (v: string) => void;
  onEdit: (s: Step) => void;
}) {
  const mood = level ? MOOD_LEVELS[level - 1]! : null;
  return (
    <div className="space-y-5">
      <label className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3">
        <CalendarClock className="size-5 shrink-0 text-primary" />
        <span className="sr-only">Дата и время</span>
        <Input
          type="datetime-local"
          value={when}
          max={maxWhen}
          onChange={(e) => onWhen(e.target.value)}
          className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
      </label>

      <SummaryBlock title="Настроение" onEdit={() => onEdit(0)}>
        {mood ? (
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${mood.soft}`}
          >
            <span className={`grid size-7 place-items-center rounded-full text-lg ${mood.bg}`}>
              {mood.emoji}
            </span>
            {mood.label}
          </span>
        ) : (
          <p className="text-sm text-destructive">Настроение не выбрано</p>
        )}
      </SummaryBlock>

      <SummaryBlock title="Эмоции" onEdit={() => onEdit(1)}>
        <TagBadges kind="emotion" keys={emotions} custom={custom} empty="Не выбраны" />
      </SummaryBlock>

      <SummaryBlock title="Активности" onEdit={() => onEdit(2)}>
        <TagBadges kind="activity" keys={activities} custom={custom} empty="Не выбраны" />
      </SummaryBlock>

      <div>
        <p className="mb-2 text-sm font-semibold">Заметка (необязательно)</p>
        <Textarea
          value={note}
          onChange={(e) => onNote(e.target.value)}
          maxLength={MAX_NOTE}
          className="min-h-24"
          placeholder="Что было сегодня? Например: «Усталость после учёбы, приятная встреча, прогулка помогла»"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {note.length}/{MAX_NOTE}
        </p>
      </div>
    </div>
  );
}

function SummaryBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Pencil className="size-3" /> Изменить
        </button>
      </div>
      {children}
    </div>
  );
}
