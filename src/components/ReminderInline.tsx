import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { browserTimeZone, DEFAULT_REMINDER_TIME, normalizeReminderTime } from "@/lib/reminders";

/** Compact reminder control so the user never has to leave the journal screen. */
export function ReminderInline() {
  const { user, profile } = useProfile();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(profile?.reminder_enabled ?? true);
  const [time, setTime] = useState(
    normalizeReminderTime(profile?.reminder_time ?? DEFAULT_REMINDER_TIME),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setEnabled(profile.reminder_enabled);
    setTime(normalizeReminderTime(profile.reminder_time));
  }, [profile]);

  const dirty =
    !!profile &&
    (profile.reminder_enabled !== enabled ||
      normalizeReminderTime(profile.reminder_time) !== normalizeReminderTime(time));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          reminder_enabled: enabled,
          reminder_time: normalizeReminderTime(time),
          reminder_timezone: browserTimeZone(),
        })
        .eq("id", user.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(enabled ? `Напомним в ${normalizeReminderTime(time)}` : "Напоминание выключено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить напоминание", {
        action: { label: "Повторить", onClick: () => void save() },
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 font-display text-base">
          <Bell className="size-4 shrink-0 text-primary" /> Напоминание о дневнике
        </p>
        <Switch
          id="journal-reminder"
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Присылать напоминание"
        />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Если записи за день ещё нет, придёт мягкое напоминание. Настроить можно прямо здесь.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-32 flex-1 space-y-1.5">
          <Label htmlFor="journal-reminder-time">Время</Label>
          <Input
            id="journal-reminder-time"
            type="time"
            value={time}
            disabled={!enabled}
            onChange={(e) => setTime(normalizeReminderTime(e.target.value))}
          />
        </div>
        <Button onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}
