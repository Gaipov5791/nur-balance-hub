import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mic, Send, ShieldAlert, Shuffle, Video } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buddies, chatMessages, lifeStatuses, profile } from "@/data/demo";
import { useProfile } from "@/hooks/useAuth";
import { awardCoins } from "@/lib/coins.functions";

export const Route = createFileRoute("/_authenticated/buddy")({
  head: () => ({
    meta: [
      { title: "Поддержи подругу — чат взаимоподдержки | Nur Balance" },
      {
        name: "description",
        content:
          "Подбор собеседницы с похожим жизненным статусом и приватный чат 1-на-1 с текстом, голосовыми и видео-сообщениями.",
      },
      { property: "og:title", content: "Поддержи подругу — Nur Balance" },
      {
        property: "og:description",
        content: "Контекстная взаимоподдержка: собеседница с похожим опытом и приватная комната.",
      },
    ],
  }),
  component: BuddyPage,
});

function BuddyPage() {
  const { profile: real } = useProfile();
  const [status, setStatus] = useState(real?.life_status ?? profile.status);
  const [active, setActive] = useState<string | null>("b1");
  const buddy = buddies.find((b) => b.id === active);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ id: string; text: string; time: string }[]>([]);
  const award = useServerFn(awardCoins);
  const qc = useQueryClient();

  const sendMessage = async (value: string) => {
    const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    setSent((prev) => [...prev, { id: `${Date.now()}`, text: value, time }]);
    setText("");
    setSending(true);
    try {
      const res = await award({ data: { action: "buddy" } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      if (res.reason === "granted") toast.success(`Сообщение отправлено. +${res.granted} Nur-Coins`);
      else toast.success("Сообщение отправлено");
    } catch {
      toast.error("Сообщение отправлено, но монеты не начислились", {
        action: { label: "Повторить", onClick: () => void sendMessage(value) },
      });
    } finally {
      setSending(false);
    }
  };


  return (
    <AppShell title="Поддержи подругу" aside={<CoinsPanel />}>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section className="surface min-w-0 p-5">
          <h2 className="font-display text-base">Категория поддержки</h2>
          <div className="mt-3 space-y-2">
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
          <Button
            className="mt-4 w-full"
            onClick={() => toast("Ищем собеседницу с похожим опытом…")}
          >
            Найти собеседницу
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Если в категории сейчас никого нет, поиск автоматически расширится на смежные статусы.
          </p>

          <h3 className="mt-6 font-display text-sm">Доступны сейчас</h3>
          <ul className="mt-3 space-y-2">
            {buddies.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setActive(b.id)}
                  className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${
                    active === b.id ? "bg-secondary" : "hover:bg-secondary/60"
                  }`}
                >
                  <span className="relative grid size-10 place-items-center rounded-full bg-primary-soft font-semibold">
                    {b.name.slice(0, 1)}
                    {b.online ? (
                      <span className="absolute -right-0 bottom-0 size-3 rounded-full border-2 border-card bg-primary" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{b.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{b.bio}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface flex min-h-[560px] flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold">
                {buddy?.name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{buddy?.name}</p>
                <p className="truncate text-xs text-muted-foreground">Приватная комната 1-на-1</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toast("Подбираем нового собеседника")}
              >
                <Shuffle className="size-4" /> Сменить
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => toast.error("Жалоба отправлена на модерацию")}
              >
                <ShieldAlert className="size-4" /> Пожаловаться
              </Button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {chatMessages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.from === "me"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {m.text}
                  <span className="mt-1 block text-[10px] opacity-70">{m.time}</span>
                </div>
              </div>
            ))}
            {sent.map((m) => (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {m.text}
                  <span className="mt-1 block text-[10px] opacity-70">{m.time}</span>
                </div>
              </div>
            ))}
          </div>

          <form
            className="flex items-center gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = text.trim();
              if (!value || sending) return;
              void sendMessage(value);
            }}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Голосовое сообщение"
              onClick={() => toast("Голосовые сообщения появятся в следующем обновлении")}
            >
              <Mic className="size-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Видео-сообщение"
              onClick={() => toast("Видео-сообщения появятся в следующем обновлении")}
            >
              <Video className="size-5" />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Напишите слова поддержки…"
              className="flex-1"
            />
            <Button type="submit" size="icon" aria-label="Отправить" disabled={!text.trim() || sending}>
              <Send className="size-4" />
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
