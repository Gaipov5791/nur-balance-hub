import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Logo } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { goals, lifeStatuses } from "@/data/demo";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["login", "signup", "reset", "update"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Вход и регистрация — Nur Balance" },
      {
        name: "description",
        content:
          "Войдите по email, выберите цель и жизненный статус, чтобы начать вести видео-дневник эмоций.",
      },
      { property: "og:title", content: "Вход в Nur Balance" },
      {
        property: "og:description",
        content: "Начните вести видео-дневник и находить поддержку от подруги по ситуации.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "reset" | "update" | "onboarding";

function safeRedirect(r?: string) {
  return r && r.startsWith("/") && !r.startsWith("//") ? r : "/";
}

function humanAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Неверный email или пароль";
  if (m.includes("already registered")) return "Этот email уже зарегистрирован — попробуйте войти";
  if (m.includes("password") && m.includes("least")) return "Пароль должен быть не короче 6 символов";
  if (m.includes("pwned") || m.includes("compromised") || m.includes("weak"))
    return "Этот пароль встречается в утечках. Выберите другой";
  if (m.includes("rate limit")) return "Слишком много попыток. Подождите минуту";
  if (m.includes("invalid email")) return "Проверьте формат email";
  return message;
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(true);
  const [goal, setGoal] = useState(goals[0]!.id);
  const [status, setStatus] = useState("burnout");

  const dest = safeRedirect(search.redirect);

  const finish = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && !profile.onboarded) setMode("onboarding");
    else navigate({ to: dest, replace: true });
  };

  // Already signed in (or returning from Google / a reset link)?
  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session && search.mode !== "update") await finish();
      if (active) setChecking(false);
    })();
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    try {
      await fn();
    } catch (e) {
      toast.error(humanAuthError(e instanceof Error ? e.message : "Что-то пошло не так"));
    } finally {
      setPending(false);
    }
  };

  const signIn = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await finish();
    });

  const signUp = () =>
    run(async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim() || email.split("@")[0] } },
      });
      if (error) throw error;
      if (!data.session) {
        toast.info("Проверьте почту, чтобы подтвердить регистрацию");
        setMode("login");
        return;
      }
      setMode("onboarding");
    });


  const reset = () =>
    run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=update`,
      });
      if (error) throw error;
      toast.success("Письмо со ссылкой для смены пароля отправлено");
      setMode("login");
    });

  const updatePassword = () =>
    run(async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Пароль обновлён");
      await finish();
    });

  const completeOnboarding = () =>
    run(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Сессия истекла, войдите снова");
      const { error } = await supabase
        .from("profiles")
        .update({ goal, life_status: status, onboarded: true })
        .eq("id", data.user.id);
      if (error) throw error;
      navigate({ to: dest, replace: true });
    });

  const field = (id: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required disabled={pending} {...props} />
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Logo />
        <div>
          <h1 className="max-w-sm text-3xl leading-tight">Три минуты в день, чтобы услышать себя</h1>
          <p className="mt-4 max-w-sm text-sm opacity-85">
            Видео-дневник эмоций, календарь настроений, монеты за заботу о себе и поддержка от
            собеседницы с похожим опытом.
          </p>
        </div>
        <p className="text-xs opacity-70">Записи хранятся приватно и видны только вам</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>

          {checking ? (
            <div className="grid place-items-center py-20 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : mode === "login" || mode === "signup" ? (
            <>
              <h2 className="text-2xl">{mode === "login" ? "Вход в Nur Balance" : "Регистрация"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "login"
                  ? "Введите email и пароль"
                  : "Аккаунт создаётся сразу, без подтверждения по почте"}
              </p>
              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  mode === "login" ? signIn() : signUp();
                }}
              >
                {mode === "signup"
                  ? field("name", "Как к вам обращаться", {
                      value: name,
                      onChange: (e) => setName(e.target.value),
                      placeholder: "Айпери",
                      required: false,
                    })
                  : null}
                {field("email", "Email", {
                  type: "email",
                  autoComplete: "email",
                  placeholder: "you@example.com",
                  value: email,
                  onChange: (e) => setEmail(e.target.value),
                })}
                {field("password", "Пароль", {
                  type: "password",
                  minLength: 6,
                  autoComplete: mode === "login" ? "current-password" : "new-password",
                  placeholder: "••••••••",
                  value: password,
                  onChange: (e) => setPassword(e.target.value),
                })}
                <Button type="submit" className="w-full" size="lg" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {mode === "login" ? "Войти" : "Создать аккаунт"}
                </Button>
              </form>
              <div className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    <span>
                      Нет аккаунта?{" "}
                      <button type="button" className="text-primary hover:underline" onClick={() => setMode("signup")}>
                        Зарегистрироваться
                      </button>
                    </span>
                    <button type="button" className="text-primary hover:underline" onClick={() => setMode("reset")}>
                      Забыли пароль?
                    </button>
                  </>
                ) : (
                  <span>
                    Уже есть аккаунт?{" "}
                    <button type="button" className="text-primary hover:underline" onClick={() => setMode("login")}>
                      Войти
                    </button>
                  </span>
                )}
              </div>
            </>
          ) : mode === "reset" ? (
            <>
              <h2 className="text-2xl">Восстановление пароля</h2>
              <p className="mt-2 text-sm text-muted-foreground">Пришлём ссылку для смены пароля на email</p>
              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  reset();
                }}
              >
                {field("email", "Email", {
                  type: "email",
                  value: email,
                  onChange: (e) => setEmail(e.target.value),
                  placeholder: "you@example.com",
                })}
                <Button type="submit" className="w-full" size="lg" disabled={pending}>
                  Отправить ссылку
                </Button>
              </form>
              <button type="button" className="mt-4 w-full text-center text-sm text-primary hover:underline" onClick={() => setMode("login")}>
                Вернуться ко входу
              </button>
            </>
          ) : mode === "update" ? (
            <>
              <h2 className="text-2xl">Новый пароль</h2>
              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  updatePassword();
                }}
              >
                {field("password", "Новый пароль", {
                  type: "password",
                  minLength: 6,
                  autoComplete: "new-password",
                  value: password,
                  onChange: (e) => setPassword(e.target.value),
                })}
                <Button type="submit" className="w-full" size="lg" disabled={pending}>
                  Сохранить пароль
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl">Пара вопросов</h2>
              <p className="mt-2 text-sm text-muted-foreground">Это поможет подобрать поддержку и практики</p>

              <p className="mt-6 text-sm font-medium">Ваша цель</p>
              <div className="mt-2 space-y-2">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                      goal === g.id ? "border-primary bg-primary-soft" : "border-border hover:bg-secondary"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              <p className="mt-5 text-sm font-medium">Жизненный статус</p>
              <div className="mt-2 space-y-2">
                {lifeStatuses.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatus(s.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
                      status === s.id ? "border-primary bg-primary-soft" : "border-border hover:bg-secondary"
                    }`}
                  >
                    <span className="text-lg">{s.emoji}</span>
                    {s.label}
                  </button>
                ))}
              </div>

              <Button className="mt-6 w-full" size="lg" onClick={completeOnboarding} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null} Начать
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
