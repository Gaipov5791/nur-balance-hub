import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddCustomTag } from "@/hooks/useMood";
import {
  MAX_CUSTOM_LABEL,
  MAX_TAGS_PER_KIND,
  customKey,
  normalizeCustomLabel,
  resolveTag,
  type CatalogGroup,
  type CustomTag,
  type TagKind,
} from "@/lib/mood";

export function TagChip({
  emoji,
  label,
  selected,
  onClick,
  disabled,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-soft"
          : "border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      <span className="shrink-0 text-base leading-none">{emoji}</span>
      <span className="min-w-0 truncate">{label}</span>
      {selected ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
    </button>
  );
}

export function TagBadges({
  kind,
  keys,
  custom,
  empty,
  max,
}: {
  kind: TagKind;
  keys: readonly string[];
  custom: readonly CustomTag[];
  empty?: string;
  /** Show at most this many, then "+N". */
  max?: number;
}) {
  if (keys.length === 0)
    return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  const shown = max ? keys.slice(0, max) : keys;
  const rest = keys.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((key) => {
        const t = resolveTag(kind, key, custom);
        return (
          <span
            key={key}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
          >
            <span className="shrink-0">{t.emoji}</span>
            <span className="min-w-0 truncate">{t.label}</span>
          </span>
        );
      })}
      {rest > 0 ? (
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

export function TagPicker({
  kind,
  groups,
  custom,
  value,
  onChange,
}: {
  kind: TagKind;
  groups: readonly CatalogGroup[];
  custom: readonly CustomTag[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const own = custom.filter((t) => t.kind === kind);
  const atLimit = value.length >= MAX_TAGS_PER_KIND;

  const toggle = (key: string) => {
    if (value.includes(key)) onChange(value.filter((k) => k !== key));
    else if (!atLimit) onChange([...value, key]);
    else toast(`Можно выбрать до ${MAX_TAGS_PER_KIND} вариантов`);
  };

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.id}>
          <h3 className="mb-2 text-sm font-semibold">{g.title}</h3>
          <div className="flex flex-wrap gap-2">
            {g.items.map((item) => (
              <TagChip
                key={item.id}
                emoji={item.emoji}
                label={item.label}
                selected={value.includes(item.id)}
                onClick={() => toggle(item.id)}
              />
            ))}
          </div>
        </section>
      ))}
      <section>
        <h3 className="mb-2 text-sm font-semibold">
          {kind === "emotion" ? "Мои эмоции" : "Мои активности"}
        </h3>
        <div className="flex flex-wrap gap-2">
          {own.map((t) => {
            const key = customKey(t.label);
            return (
              <TagChip
                key={t.id}
                emoji={t.emoji}
                label={t.label}
                selected={value.includes(key)}
                onClick={() => toggle(key)}
              />
            );
          })}
          <AddCustomTag
            kind={kind}
            existing={own}
            onAdded={(key) => {
              if (!value.includes(key) && !atLimit) onChange([...value, key]);
            }}
          />
        </div>
      </section>
    </div>
  );
}

function AddCustomTag({
  kind,
  existing,
  onAdded,
}: {
  kind: TagKind;
  existing: readonly CustomTag[];
  onAdded: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("");
  const add = useAddCustomTag();

  const submit = async () => {
    const clean = normalizeCustomLabel(label);
    if (!clean) {
      toast.error("Напиши название");
      return;
    }
    if (!existing.some((t) => t.label === clean)) {
      try {
        await add.mutateAsync({ kind, label: clean, emoji: emoji.trim() });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не удалось добавить вариант");
        return;
      }
    }
    onAdded(customKey(clean));
    setLabel("");
    setEmoji("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/50 px-3 py-1.5 text-sm text-primary hover:bg-primary-soft"
      >
        <Plus className="size-4" /> {kind === "emotion" ? "Своя эмоция" : "Своя активность"}
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-secondary/50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Input
        value={emoji}
        onChange={(e) => setEmoji(e.target.value.slice(0, 8))}
        placeholder="✨"
        aria-label="Эмодзи"
        className="w-14 text-center"
      />
      <Input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={MAX_CUSTOM_LABEL}
        placeholder={kind === "emotion" ? "Например, ностальгия" : "Например, шахматы"}
        aria-label="Название"
        className="min-w-0 flex-1"
      />
      <Button type="submit" size="sm" disabled={add.isPending}>
        {add.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Добавить
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Отмена
      </Button>
    </form>
  );
}
