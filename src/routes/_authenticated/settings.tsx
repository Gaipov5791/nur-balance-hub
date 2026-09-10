import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useProfile, useSignOut } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { awardCoins } from "@/lib/coins.functions";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

function PasswordCard() {
  const { user } = useProfile();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user?.email) return;
    if (next.length < 6) {
      toast.error("Новый пароль должен быть не короче 6 символов");
      return;
    }
    if (next !== repeat) {
      toast.error("Новый пароль и подтверждение не совпадают");
      return;
    }
    setBusy(true);
    try {
      const { error: checkError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (checkError) {
        toast.error("Текущий пароль указан неверно");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setCurrent("");
      setNext("");
      setRepeat("");
      toast.success("Пароль обновлён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось изменить пароль", {
        action: { label: "Повторить", onClick: () => void submit() },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface p-5">
      <h2 className="font-display text-base">Смена пароля</h2>
      <div className="mt-4 space-y-2">
        <Label htmlFor="cur-pass">Текущий пароль</Label>
        <Input
          id="cur-pass"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Label htmlFor="new-pass">Новый пароль</Label>
        <Input
          id="new-pass"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Label htmlFor="rep-pass">Повторите новый пароль</Label>
        <Input
          id="rep-pass"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
      </div>
      <Button
        className="mt-4"
        variant="secondary"
        onClick={submit}
        disabled={busy || !current || !next}
      >
        {busy ? "Обновляем…" : "Изменить пароль"}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        Если вы входите через Google, пароль задавать не нужно.
      </p>
    </div>
  );
}

function AccountCard() {
  const { user } = useProfile();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="surface p-5">
      <h2 className="font-display text-base">Аккаунт</h2>
      {user ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Вы вошли как {user.email}</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" className="mt-4 w-full" disabled={leaving}>
                {leaving ? "Выходим…" : "Выйти"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Выйти из аккаунта?</AlertDialogTitle>
                <AlertDialogDescription>
                  Записи дневника останутся в вашем архиве. Чтобы вернуться, нужно будет войти
                  снова.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Остаться</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setLeaving(true);
                    try {
                      await signOut();
                      toast.success("Вы вышли из аккаунта");
                      navigate({ to: "/auth" });
                    } catch {
                      toast.error("Не удалось выйти, попробуйте ещё раз");
                    } finally {
                      setLeaving(false);
                    }
                  }}
                >
                  Выйти
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
  const award = useServerFn(awardCoins);
  const [name, setName] = useState(real?.name ?? user?.email?.split("@")[0] ?? "");
  const [goal, setGoal] = useState(real?.goal ?? goals[0]!.id);
  const [status, setStatus] = useState(real?.life_status ?? "burnout");
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

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
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Укажите имя, чтобы мы знали, как к вам обращаться");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: trimmed, goal, life_status: status })
        .eq("id", user.id);
      if (error) throw error;
      setName(trimmed);
      let bonus = 0;
      if (goal && status) {
        try {
          const res = await award({ data: { action: "profile_complete" } });
          bonus = res.granted;
        } catch {
          /* профиль сохранён — бонус начислим при следующем сохранении */
        }
      }
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(
        bonus > 0
          ? `Готово, ${trimmed}! Изменения сохранены. +${bonus} Nur-Coins за заполненный профиль`
          : `Готово, ${trimmed}! Изменения сохранены`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Не удалось сохранить: ${e.message}`
          : "Не удалось сохранить. Проверьте соединение",
        { action: { label: "Повторить", onClick: () => void save() } },
      );
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
                <Button
                  variant="secondary"
                  onClick={() => toast("PIN-код появится в ближайшем обновлении")}
                >
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
                  try {
                    localStorage.setItem("nur-theme", v ? "dark" : "light");
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </div>
          </div>

          <PasswordCard />

          <AccountCard />

        </section>
      </div>
    </AppShell>
  );
}
