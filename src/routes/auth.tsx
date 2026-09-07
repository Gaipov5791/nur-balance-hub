import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { goals, lifeStatuses } from "@/data/demo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход и регистрация — Nur Balance" },
      {
        name: "description",
        content:
          "Войдите по email или через Google, выберите цель и жизненный статус, чтобы начать вести видео-дневник эмоций.",
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

function AuthPage() {
  const [step, setStep] = useState<"login" | "onboarding">("login");
  const [goal, setGoal] = useState(goals[0]!.id);
  const [status, setStatus] = useState("burnout");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Logo />
        <div>
          <h1 className="max-w-sm text-3xl leading-tight">
            Три минуты в день, чтобы услышать себя
          </h1>
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

          {step === "login" ? (
            <>
              <h2 className="text-2xl">Вход в Nur Balance</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Введите email или продолжите через Google
              </p>
              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep("onboarding");
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Пароль</Label>
                  <Input id="password" type="password" placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  Войти
                </Button>
              </form>
              <Button
                variant="secondary"
                className="mt-3 w-full"
                size="lg"
                onClick={() => setStep("onboarding")}
              >
                Продолжить с Google
              </Button>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Нет аккаунта?{" "}
                <button
                  className="text-primary hover:underline"
                  onClick={() => setStep("onboarding")}
                >
                  Зарегистрироваться
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl">Пара вопросов</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Это поможет подобрать поддержку и практики
              </p>

              <p className="mt-6 text-sm font-medium">Ваша цель</p>
              <div className="mt-2 space-y-2">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                      goal === g.id
                        ? "border-primary bg-primary-soft"
                        : "border-border hover:bg-secondary"
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

              <Button asChild className="mt-6 w-full" size="lg">
                <Link to="/">Начать</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
