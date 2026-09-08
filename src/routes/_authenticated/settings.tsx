import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useProfile, useSignOut } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { goals, lifeStatuses } from "@/data/demo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Настройки профиля и приватности — Nur Balance" },
      {
        name: "description",
        content:
          "Цель, жизненный статус для подбора бадди, PIN-код на архив видео-дневников и оформление интерфейса.",
      },
      { property: "og:title", content: "Настройки — Nur Balance" },
      {
        property: "og:description",
        content: "Управляйте приватностью дневника и категорией взаимоподдержки.",
      },
    ],
  }),
  component: SettingsPage,
});

function AccountCard() {
  const { user } = useProfile();
  const signOut = useSignOut();
  const navigate = useNavigate();
  return (
    <div className="surface p-5">
      <h2 className="font-display text-base">Аккаунт</h2>
      {user ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Вы вошли как {user.email}</p>
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={async () => {
              await signOut();
              toast.success("Вы вышли из аккаунта");
              navigate({ to: "/auth" });
            }}
          >
            Выйти
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Войдите, чтобы записи дневника сохранялись в вашем личном архиве.
          </p>
          <Button asChild className="mt-4 w-full">
            <Link to="/auth">Войти или зарегистрироваться</Link>
          </Button>
        </>
      )}
    </div>
  );
}

function SettingsPage() {
  const { user, profile: real } = useProfile();
  const qc = useQueryClient();
  const [name, setName] = useState(real?.name ?? user?.email?.split("@")[0] ?? "");
  const [goal, setGoal] = useState(real?.goal ?? goals[0]!.id);
  const [status, setStatus] = useState(real?.life_status ?? "burnout");
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState(true);
  const [dark, setDark] = useState(false);

  // Sync local state when profile loads
  useEffect(() => {
    if (real) {
      setName(real.name);
      setGoal(real.goal ?? goals[0]!.id);
      setStatus(real.life_status ?? "burnout");
    }
  }, [real]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name, goal, life_status: status })
        .eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Изменения сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Настройки" aside={<CoinsPanel />}>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-display text-base">Профиль</h2>
          <div className="mt-4 flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-2xl bg-primary-soft font-display text-xl">
              {((name || user?.email?.[0]) ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="flex-1 space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться" />
              <Input value={user?.email ?? ""} disabled />
            </div>
          </div>

          <p className="mt-6 text-sm font-medium">Текущая цель</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {goals.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoal(g.id)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  goal === g.id
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm font-medium">Жизненный статус</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {lifeStatuses.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
                  status === s.id
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <span className="text-lg">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>

          <Button className="mt-5" onClick={save} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </section>

        <section className="space-y-5">
          <div className="surface p-5">
            <h2 className="font-display text-base">Приватность</h2>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-secondary/70 p-4">
              <div>
                <Label htmlFor="pin">PIN-код на архив дневника</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Запрашивать код перед просмотром записей
                </p>
              </div>
              <Switch id="pin" checked={pin} onCheckedChange={setPin} />
            </div>
            {pin ? (
              <div className="mt-3 flex gap-2">
                <Input placeholder="Новый PIN" inputMode="numeric" maxLength={4} />
                <Button variant="secondary" onClick={() => toast.success("PIN обновлён")}>
                  Обновить
                </Button>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              Видео-записи видны только вам и не публикуются в модуле поддержки.
            </p>
          </div>

          <div className="surface p-5">
            <h2 className="font-display text-base">Оформление</h2>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-secondary/70 p-4">
              <div>
                <Label htmlFor="theme">Тёмная тема</Label>
                <p className="mt-1 text-sm text-muted-foreground">Мягкий контраст для вечера</p>
              </div>
              <Switch
                id="theme"
                checked={dark}
                onCheckedChange={(v) => {
                  setDark(v);
                  document.documentElement.classList.toggle("dark", v);
                }}
              />
            </div>
          </div>

          <AccountCard />
        </section>
      </div>
    </AppShell>
  );
}
