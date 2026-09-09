import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatSlot } from "@/routes/_authenticated/therapists";

type SlotAdminRow = {
  id: string;
  therapist_id: string;
  starts_at: string;
  duration_minutes: number;
  format: string;
  is_booked: boolean;
  is_active: boolean;
};

export function TherapistSlotsAdminPanel() {
  const qc = useQueryClient();
  const [therapistId, setTherapistId] = useState<string>("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState("50");
  const [format, setFormat] = useState("online");
  const [saving, setSaving] = useState(false);

  const therapists = useQuery({
    queryKey: ["admin", "therapists-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("id, name")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = therapistId || therapists.data?.[0]?.id || "";

  const slots = useQuery({
    queryKey: ["admin", "slots", active],
    enabled: !!active,
    queryFn: async (): Promise<SlotAdminRow[]> => {
      const { data, error } = await supabase
        .from("therapist_slots")
        .select("id, therapist_id, starts_at, duration_minutes, format, is_booked, is_active")
        .eq("therapist_id", active)
        .order("starts_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SlotAdminRow[];
    },
  });

  const addSlot = async () => {
    if (!active || !startsAt) {
      toast.error("Выберите специалиста и дату/время слота");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("therapist_slots").insert({
      therapist_id: active,
      starts_at: new Date(startsAt).toISOString(),
      duration_minutes: Number(duration) || 50,
      format,
    });
    setSaving(false);
    if (error) {
      toast.error("Не удалось добавить слот", {
        action: { label: "Повторить", onClick: () => void addSlot() },
      });
      return;
    }
    setStartsAt("");
    await qc.invalidateQueries({ queryKey: ["admin", "slots"] });
    await qc.invalidateQueries({ queryKey: ["therapist-slots"] });
    toast.success("Слот добавлен в расписание");
  };

  const removeSlot = async (id: string) => {
    const { error } = await supabase.from("therapist_slots").delete().eq("id", id);
    if (error) {
      toast.error("Не удалось удалить слот", {
        action: { label: "Повторить", onClick: () => void removeSlot(id) },
      });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["admin", "slots"] });
    await qc.invalidateQueries({ queryKey: ["therapist-slots"] });
    toast.success("Слот удалён");
  };

  const toggleActive = async (row: SlotAdminRow) => {
    const { error } = await supabase
      .from("therapist_slots")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast.error("Не удалось обновить слот");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["admin", "slots"] });
    await qc.invalidateQueries({ queryKey: ["therapist-slots"] });
  };

  return (
    <div className="surface p-5">
      <h2 className="flex items-center gap-2 font-display text-base">
        <CalendarClock className="size-4 text-primary" /> Расписание специалистов
      </h2>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <select
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
          value={active}
          onChange={(e) => setTherapistId(e.target.value)}
        >
          {(therapists.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        <Input
          type="number"
          min={15}
          step={5}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Длительность, мин"
        />
        <select
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="online">Онлайн</option>
          <option value="offline">Офлайн</option>
        </select>
      </div>
      <Button className="mt-3" onClick={() => void addSlot()} disabled={saving}>
        Добавить слот
      </Button>

      {slots.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Загружаем расписание…</p>
      ) : (slots.data ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Слотов пока нет.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {(slots.data ?? []).map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{formatSlot(s.starts_at, s.duration_minutes)}</p>
                <p className="text-xs text-muted-foreground">
                  {s.format === "offline" ? "офлайн" : "онлайн"}
                  {s.is_booked ? " · занят" : " · свободен"}
                  {s.is_active ? "" : " · скрыт"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => void toggleActive(s)}>
                  {s.is_active ? "Скрыть" : "Показать"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void removeSlot(s.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
