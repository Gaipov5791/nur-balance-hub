import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Bot, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/nur-ai")({
  head: () => ({
    meta: [
      { title: "НурAI — ИИ-помощник Nur Balance" },
      { name: "description", content: "Бережный ИИ-помощник: поддержка в трудную минуту и ответы о том, как устроено приложение." },
      { property: "og:title", content: "НурAI — ИИ-помощник Nur Balance" },
      { property: "og:description", content: "Поддержка и подсказки по приложению в любое время суток." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NurAiPage,
});

type Msg = { id: string; role: "user" | "assistant"; content: string };

function NurAiPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const history = useQuery({
    queryKey: ["nur-ai", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("id, role, content")
        .order("created_at")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });
  const usage = useQuery({
    queryKey: ["nur-ai-usage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ai_usage_today");
      if (error) throw error;
      return data as { used: number; limit: number };
    },
  });

  const [local, setLocal] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const items = [...(history.data ?? []), ...local];
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, local[local.length - 1]?.content]);
  useEffect(() => inputRef.current?.focus(), [busy]);

  const send = async (override?: string) => {
    const body = (override ?? text).trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    setText("");
    const answerId = `a-${Date.now()}`;
    setLocal([{ id: `u-${Date.now()}`, role: "user", content: body }, { id: answerId, role: "assistant", content: "" }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/public/nur-ai", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ text: body }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "НурAI сейчас недоступен. Попробуйте чуть позже");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setLocal((l) => l.map((m) => (m.id === answerId ? { ...m, content: acc } : m)));
      }
      if (!acc.trim()) throw new Error("НурAI не смог ответить. Попробуйте переформулировать позже");
      await qc.invalidateQueries({ queryKey: ["nur-ai", user?.id] });
      setLocal([]);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Ошибка соединения";
      setError(msg);
      await qc.invalidateQueries({ queryKey: ["nur-ai", user?.id] });
      setLocal([]);
    } finally {
      setBusy(false);
      abortRef.current = null;
      void qc.invalidateQueries({ queryKey: ["nur-ai-usage", user?.id] });
    }
  };

  const clear = async () => {
    if (!user || !confirm("Удалить всю переписку с НурAI?")) return;
    const { error: err } = await supabase.from("ai_chat_messages").delete().eq("user_id", user.id);
    if (err) toast.error("Не удалось очистить переписку");
    else {
      toast.success("Переписка очищена");
      void qc.invalidateQueries({ queryKey: ["nur-ai", user.id] });
    }
  };

  const left = usage.data ? Math.max(0, usage.data.limit - usage.data.used) : null;

  return (
    <AppShell title="НурAI">
      <section className="surface flex min-h-[70vh] min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Bot className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">НурAI</p>
              <p className="text-xs text-muted-foreground">Это ИИ, а не психолог и не живой человек</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {left !== null ? <span className="text-xs text-muted-foreground">Осталось сегодня: {left}</span> : null}
            <Button variant="ghost" size="sm" onClick={() => void clear()} disabled={busy || !(history.data ?? []).length}>
              <Trash2 className="size-4" /> Очистить
            </Button>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {history.isLoading ? (
            <p className="text-sm text-muted-foreground">Загружаем переписку…</p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
              <p className="font-semibold">Привет! Я НурAI.</p>
              <p className="mt-1">Можно рассказать, что на душе, или спросить, как устроено приложение.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Мне тревожно, не могу уснуть", "Как записаться к психологу?", "Как заработать Nur-Coins?"].map((s) => (
                  <Button key={s} size="sm" variant="secondary" className="bg-background" onClick={() => void send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            items.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] whitespace-pre-line break-words rounded-2xl bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-[90%] break-words text-foreground dark:prose-invert">
                    {m.content ? (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    ) : (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> НурAI печатает…
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {error ? (
            <div className="rounded-xl border border-destructive/40 p-3 text-sm">
              <p className="text-destructive">{error}</p>
              {error.includes("лимит") ? (
                <Button asChild size="sm" variant="secondary" className="mt-2">
                  <Link to="/buddy">Найти собеседника</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <p className="px-4 text-[11px] text-muted-foreground">
          В опасной ситуации звоните 112 или на телефон доверия 150 (бесплатно, круглосуточно).
        </p>
        <form
          className="flex items-end gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="Напишите НурAI…"
            className="min-w-0 flex-1 resize-none"
          />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Отправить">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </section>
    </AppShell>
  );
}
