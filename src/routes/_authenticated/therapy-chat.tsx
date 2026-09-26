import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mic, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaMessageRecorder } from "@/components/MediaMessageRecorder";
import { formatTime } from "@/components/VideoRecorder";
import { useAuth } from "@/hooks/useAuth";
import {
  useTherapyChats,
  useTherapyMedia,
  useTherapyMessages,
  type TherapyMessage,
} from "@/hooks/useTherapyChat";
import { supabase } from "@/integrations/supabase/client";
import { uploadWithRetry } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/therapy-chat")({
  validateSearch: (search: Record<string, unknown>) => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Чат со специалистом — Nur Balance" },
      {
        name: "description",
        content: "Личная переписка с психологом внутри приложения: текст, голосовые сообщения и файлы.",
      },
      { property: "og:title", content: "Чат со специалистом — Nur Balance" },
      { property: "og:description", content: "Личная переписка с психологом внутри приложения." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TherapyChatPage,
});

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("pdf")) return "pdf";
  return "webm";
}

function AttachmentBubble({ message, mine }: { message: TherapyMessage; mine: boolean }) {
  const { data: url, isLoading, isError } = useTherapyMedia(message.media_path);
  if (isLoading) {
    return (
      <span className="flex items-center gap-2 text-xs opacity-80">
        <Loader2 className="size-3.5 animate-spin" /> Загружаем…
      </span>
    );
  }
  if (isError || !url) return <span className="text-xs opacity-80">Не удалось открыть файл</span>;
  return (
    <div className={mine ? "text-primary-foreground" : ""}>
      {message.kind === "audio" ? (
        <audio src={url} controls className="w-56 max-w-full" />
      ) : message.kind === "image" ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="Фото из чата" className="w-64 max-w-full rounded-xl" />
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="text-sm underline">
          {message.body || "Открыть файл"}
        </a>
      )}
      {message.kind === "audio" ? (
        <span className="mt-1 block text-[10px] opacity-70">
          Голосовое · {formatTime(message.duration_seconds)}
        </span>
      ) : null}
    </div>
  );
}

function TherapyChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chat: chatId } = Route.useSearch();
  const chats = useTherapyChats();
  const chat = (chats.data ?? []).find((c) => c.id === chatId) ?? null;
  const messages = useTherapyMessages(chat?.id ?? null);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = messages.data ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length]);

  const sendMessage = async (payload: {
    kind: TherapyMessage["kind"];
    body?: string;
    media_path?: string | null;
    duration_seconds?: number;
  }) => {
    if (!chat || !user) return;
    const { error } = await supabase.from("therapist_messages").insert({
      chat_id: chat.id,
      sender_id: user.id,
      kind: payload.kind,
      body: payload.body ?? "",
      media_path: payload.media_path ?? null,
      duration_seconds: payload.duration_seconds ?? 0,
    });
    if (error) throw error;
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendMessage({ kind: "text", body });
      setText("");
    } catch {
      toast.error("Сообщение не отправлено. Попробуйте ещё раз", {
        action: { label: "Повторить", onClick: () => void sendText() },
      });
    } finally {
      setSending(false);
    }
  };

  const sendVoice = async (blob: Blob, mime: string, duration: number) => {
    if (!chat || !user) return;
    setSending(true);
    try {
      const path = `${user.id}/${chat.id}/${Date.now()}.${extFor(mime)}`;
      await uploadWithRetry("therapist-media", path, blob, mime);
      await sendMessage({ kind: "audio", media_path: path, duration_seconds: duration });
      setRecorderOpen(false);
      toast.success("Голосовое отправлено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить голосовое");
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (file: File) => {
    if (!chat || !user) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Файл больше 50 МБ — выберите файл поменьше");
      return;
    }
    setSending(true);
    try {
      const path = `${user.id}/${chat.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      await uploadWithRetry("therapist-media", path, file, file.type || "application/octet-stream");
      const kind = file.type.startsWith("image/") ? "image" : "file";
      await sendMessage({ kind, media_path: path, body: file.name });
      toast.success("Файл отправлен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить файл");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title={chat ? `Чат — ${chat.therapist_name}` : "Чат со специалистом"}>
      {!chatId ? (
        <div className="surface p-6">
          <h2 className="font-display text-base">Ваши чаты со специалистами</h2>
          {chats.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Загружаем…</p>
          ) : (chats.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Чат появится автоматически, когда специалист подтвердит вашу запись.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(chats.data ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/therapy-chat", search: { chat: c.id } })}
                    className="surface flex w-full items-center justify-between gap-3 p-4 text-left transition-shadow hover:shadow-lift"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.therapist_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        Открыт {new Date(c.created_at).toLocaleDateString("ru-RU")}
                      </span>
                    </span>
                    <Send className="size-4 shrink-0 text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : chats.isLoading ? (
        <div className="surface grid place-items-center p-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !chat ? (
        <div className="surface p-6 text-center">
          <p className="font-semibold">Чат не найден</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Возможно, запись ещё не подтверждена или чат принадлежит другому аккаунту.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => navigate({ to: "/therapy-chat" })}
          >
            <ArrowLeft className="size-4" /> К списку чатов
          </Button>
        </div>
      ) : (
        <section className="surface flex min-h-[60vh] flex-col p-4 sm:p-5">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/therapy-chat" })}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{chat.therapist_name}</p>
              <p className="text-xs text-muted-foreground">Личная переписка · видите только вы двое</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto py-4">
            {messages.isLoading ? (
              <p className="text-sm text-muted-foreground">Загружаем сообщения…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Сообщений пока нет — напишите первым.
              </p>
            ) : (
              items.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {m.media_path ? <AttachmentBubble message={m} mine={mine} /> : null}
                      {m.body && m.kind === "text" ? (
                        <p className="whitespace-pre-line break-words">{m.body}</p>
                      ) : null}
                      <span className="mt-1 block text-right text-[10px] opacity-70">
                        {new Date(m.created_at).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {recorderOpen ? (
            <div className="mb-3">
              <MediaMessageRecorder
                kind="audio"
                maxSeconds={120}
                busy={sending}
                onSend={sendVoice}
                onCancel={() => setRecorderOpen(false)}
              />
            </div>
          ) : null}

          <form
            className="flex items-center gap-2 border-t border-border pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendText();
            }}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void sendFile(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Прикрепить файл"
              disabled={sending}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Записать голосовое"
              disabled={sending}
              onClick={() => setRecorderOpen((v) => !v)}
            >
              <Mic className="size-4" />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Написать сообщение…"
              className="min-w-0 flex-1"
            />
            <Button type="submit" size="icon" disabled={sending || !text.trim()} aria-label="Отправить">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </section>
      )}
    </AppShell>
  );
}
