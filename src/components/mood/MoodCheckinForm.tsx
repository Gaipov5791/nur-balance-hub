import { useMemo, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAddCustomTag, useCustomTags, useSaveCheckin } from "@/hooks/useMood";
import {
  ACTIVITY_GROUPS,
  canSaveCheckin,
  EMOTION_GROUPS,
  MOOD_LEVELS,
  type Checkin,
  type TagGroup,
} from "@/lib/mood";

export function MoodCheckinForm({
  editing,
  initialLevel,
  onDone,
}: {
  editing?: Checkin;
  initialLevel?: number | undefined;
  onDone?: () => void;
}) {
  const [level, setLevel] = useState<number | null>(editing?.level ?? initialLevel ?? null);
  const [emotions, setEmotions] = useState<string[]>(editing?.emotions ?? []);
  const [activities, setActivities] = useState<string[]>(editing?.activities ?? []);
  const [note, setNote] = useState(editing?.note ?? "");
  const save = useSaveCheckin();
  const custom = useCustomTags();

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const withCustom = (groups: TagGroup[], kind: "emotion" | "activity"): TagGroup[] => {
    const mine = (custom.data ?? []).filter((c) => c.kind === kind);
    return mine.length ? [...groups, { title: "Мои", items: mine }] : groups;
  };

  const submit = async () => {
    if (save.isPending) return;
    if (!canSaveCheckin({ level })) {
      toast.error("Выбери настроение — это единственное обязательное поле");
      return;
    }
    try {
      await save.mutateAsync({ id: editing?.id, level: level!, emotions, activities, note });
      toast.success(editing ? "Отметка обновлена" : "Настроение сохранено 🌿");
      if (!editing) {
        setLevel(null);
        setEmotions([]);
        setActivities([]);
        setNote("");
      }
      onDone?.();
    } catch {
      toast.error("Не удалось сохранить. Проверь интернет и попробуй ещё раз");
    }
  };

  return (
    <div className="space-y-5">
      <section className="surface p-5 md:p-6">
        <h2 className="font-display text-lg">Как твоё настроение сейчас?</h2>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {MOOD_LEVELS.map((m) => {
            const active = level === m.level;
            return (
              <button
                key={m.level}
                type="button"
                onClick={() => setLevel(m.level)}
                aria-pressed={active}
                className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border-2 px-0.5 py-2 transition-all sm:p-3 ${
                  active ? `${m.soft} border-current ${m.text} scale-105` : "border-transparent bg-secondary/60 hover:bg-secondary"
                }`}
              >
                <span className={`grid size-11 place-items-center rounded-full text-2xl sm:size-12 ${m.bg}`}>{m.emoji}</span>
                <span className="w-full text-center text-[10px] font-medium leading-tight text-foreground sm:text-xs">
                  <span className="sm:hidden">{m.short}</span><span className="hidden sm:inline">{m.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <TagPicker
        title="Эмоции"
        hint="Что ты чувствуешь? Можно выбрать несколько"
        kind="emotion"
        groups={withCustom(EMOTION_GROUPS, "emotion")}
        selected={emotions}
        onToggle={(id) => toggle(emotions, setEmotions, id)}
        onAdded={(id) => setEmotions((v) => (v.includes(id) ? v : [...v, id]))}
      />
      <TagPicker
        title="Активности"
        hint="Чем ты занимался(ась)? Можно выбрать несколько"
        kind="activity"
        groups={withCustom(ACTIVITY_GROUPS, "activity")}
        selected={activities}
        onToggle={(id) => toggle(activities, setActivities, id)}
        onAdded={(id) => setActivities((v) => (v.includes(id) ? v : [...v, id]))}
      />

      <section className="surface p-5 md:p-6">
        <label htmlFor="mood-note" className="font-display text-base">
          Заметка <span className="text-sm font-normal text-muted-foreground">(необязательно)</span>
        </label>
        <Textarea
          id="mood-note"
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Что повлияло на настроение? Например: «Устал(а) после учёбы, прогулка помогла»"
          className="mt-3 min-h-24"
        />
        <Button size="lg" className="mt-4 w-full" onClick={submit} disabled={save.isPending || level === null}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {editing ? "Сохранить изменения" : "Сохранить"}
        </Button>
        {level === null ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">Сначала выбери настроение вверху</p>
        ) : null}
      </section>
    </div>
  );
}

function TagPicker({
  title,
  hint,
  kind,
  groups,
  selected,
  onToggle,
  onAdded,
}: {
  title: string;
  hint: string;
  kind: "emotion" | "activity";
  groups: TagGroup[];
  selected: string[];
  onToggle: (id: string) => void;
  onAdded: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("");
  const add = useAddCustomTag();
  const count = useMemo(() => selected.length, [selected]);

  const submitNew = async () => {
    const clean = label.trim();
    if (clean.length < 1) return;
    try {
      const id = await add.mutateAsync({ kind, label: clean, emoji });
      onAdded(id);
      setLabel("");
      setEmoji("");
      setAdding(false);
    } catch {
      toast.error("Не удалось добавить. Попробуй ещё раз");
    }
  };

  return (
    <section className="surface p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg">{title}</h2>
        {count ? <span className="text-xs text-muted-foreground">выбрано: {count}</span> : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <div className="mt-4 space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
            <div className="flex flex-wrap gap-2">
              {g.items.map((item) => {
                const on = selected.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggle(item.id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <span>{item.emoji}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {adding ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🙂" maxLength={4} className="w-16" aria-label="Эмодзи" />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
            placeholder={kind === "emotion" ? "Своя эмоция" : "Своя активность"}
            maxLength={40}
            className="min-w-0 flex-1"
          />
          <Button onClick={submitNew} disabled={add.isPending || !label.trim()}>
            Добавить
          </Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>
            Отмена
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> {kind === "emotion" ? "Своя эмоция" : "Своя активность"}
        </Button>
      )}
    </section>
  );
}
