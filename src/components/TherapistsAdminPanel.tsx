import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type TherapistAdminRow = {
  id: string;
  name: string;
  initials: string;
  spec: string;
  experience: string;
  bio: string;
  price_label: string;
  languages: string;
  photo_url: string | null;
  contact_email: string | null;
  is_verified: boolean;
  is_active: boolean;
  sort_order: number;
};

type FormState = Omit<TherapistAdminRow, "id"> & { id: string | null };

const EMPTY: FormState = {
  id: null,
  name: "",
  initials: "",
  spec: "",
  experience: "",
  bio: "",
  price_label: "",
  languages: "Русский, Казахский",
  photo_url: "",
  contact_email: "",
  is_verified: false,
  is_active: true,
  sort_order: 0,
};

const SELECT =
  "id, name, initials, spec, experience, bio, price_label, languages, photo_url, contact_email, is_verified, is_active, sort_order";

/** Admin CRUD for the therapist catalog: create, edit, hide cards. */
export function TherapistsAdminPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const list = useQuery({
    queryKey: ["admin", "therapists"],
    queryFn: async (): Promise<TherapistAdminRow[]> => {
      const { data, error } = await supabase
        .from("therapists")
        .select(SELECT)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TherapistAdminRow[];
    },
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "therapists"] });
    await qc.invalidateQueries({ queryKey: ["therapists"] });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("Укажите имя специалиста");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      initials: form.initials.trim() || form.name.trim().slice(0, 2).toUpperCase(),
      spec: form.spec.trim(),
      experience: form.experience.trim(),
      bio: form.bio.trim(),
      price_label: form.price_label.trim(),
      languages: form.languages.trim(),
      photo_url: form.photo_url?.trim() ? form.photo_url.trim() : null,
      contact_email: form.contact_email?.trim() ? form.contact_email.trim() : null,
      is_verified: form.is_verified,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    };
    const { error } = form.id
      ? await supabase.from("therapists").update(payload).eq("id", form.id)
      : await supabase.from("therapists").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Не удалось сохранить карточку", {
        action: { label: "Повторить", onClick: () => void save() },
      });
      return;
    }
    setForm(null);
    await refresh();
    toast.success("Карточка сохранена");
  };

  const toggleActive = async (row: TherapistAdminRow) => {
    const { error } = await supabase
      .from("therapists")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast.error("Не удалось изменить видимость карточки");
      return;
    }
    await refresh();
    toast.success(row.is_active ? "Карточка скрыта" : "Карточка снова видна");
  };

  return (
    <div className="surface mb-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base">
          <UserRound className="size-4 text-primary" /> Каталог психологов
        </h2>
        <Button size="sm" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="size-4" /> Добавить специалиста
        </Button>
      </div>

      {form ? (
        <form
          className="mt-4 grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input
            placeholder="Имя и фамилия"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Инициалы (например, ТА)"
            value={form.initials}
            onChange={(e) => setForm({ ...form, initials: e.target.value })}
          />
          <Input
            className="sm:col-span-2"
            placeholder="Специализация"
            value={form.spec}
            onChange={(e) => setForm({ ...form, spec: e.target.value })}
          />
          <Input
            placeholder="Опыт (например, 12 лет практики)"
            value={form.experience}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
          />
          <Input
            placeholder="Стоимость (например, от 30 000 ₸ за сессию)"
            value={form.price_label}
            onChange={(e) => setForm({ ...form, price_label: e.target.value })}
          />
          <Input
            placeholder="Языки"
            value={form.languages}
            onChange={(e) => setForm({ ...form, languages: e.target.value })}
          />
          <Input
            placeholder="Email для связи"
            value={form.contact_email ?? ""}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
          <Input
            className="sm:col-span-2"
            placeholder="Ссылка на фото, например /therapists/name.jpg"
            value={form.photo_url ?? ""}
            onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
          />
          <Textarea
            className="min-h-24 sm:col-span-2"
            placeholder="Описание, формат работы, цены"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_verified}
              onChange={(e) => setForm({ ...form, is_verified: e.target.checked })}
            />
            Проверенный специалист
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Показывать в каталоге
          </label>
          <Input
            type="number"
            placeholder="Порядок"
            value={String(form.sort_order)}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              Сохранить
            </Button>
            <Button type="button" variant="secondary" onClick={() => setForm(null)}>
              Отмена
            </Button>
          </div>
        </form>
      ) : null}

      {list.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Загружаем…</p>
      ) : (list.data ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Каталог пока пуст.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {(list.data ?? []).map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {t.name}
                  {!t.is_active ? (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-normal">
                      скрыт
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[t.spec, t.experience, t.price_label].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setForm({ ...t, photo_url: t.photo_url ?? "", contact_email: t.contact_email ?? "" })}
                >
                  <Pencil className="size-4" /> Изменить
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void toggleActive(t)}>
                  {t.is_active ? "Скрыть" : "Показать"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void linkAccount(t)}>
                  <LinkIcon className="size-4" /> Привязать вход
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
