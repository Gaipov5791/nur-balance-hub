import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  Search,
  Send,
  ShieldAlert,
  Shuffle,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaMessageRecorder, type MediaKind } from "@/components/MediaMessageRecorder";
import { formatTime } from "@/components/VideoRecorder";
import { lifeStatuses } from "@/data/demo";
import { useAuth, useProfile } from "@/hooks/useAuth";
import {
  useActiveMatch,
  useBuddyMessages,
  useSignedMedia,
  type BuddyMessage,
} from "@/hooks/useBuddyChat";
import { supabase } from "@/integrations/supabase/client";
import { uploadWithRetry } from "@/lib/upload";
import { awardCoins } from "@/lib/coins.functions";

export const Route = createFileRoute("/_authenticated/buddy")({
  head: () => ({
    meta: [
      { title: "Поддержи подругу — живой чат взаимоподдержки | Nur Balance" },
      {
        name: "description",
        content:
          "Подбор собеседницы с похожим жизненным статусом и приватный чат 1-на-1: текст, голосовые и видео-сообщения, жалобы и модерация.",
      },
      { property: "og:title", content: "Поддержи подругу — Nur Balance" },
      {
        property: "og:description",
        content: "Живой подбор собеседницы и приватная комната с поддержкой в реальном времени.",
      },
    ],
  }),
  component: BuddyPage,
});

const REPORT_REASONS = [
  { id: "harassment", label: "Оскорбления или агрессия" },
  { id: "spam", label: "Спам или реклама" },
  { id: "unsafe", label: "Опасное поведение, угрозы" },
  { id: "other", label: "Другое" },
];

function MediaBubble({ message, mine }: { message: BuddyMessage; mine: boolean }) {
  const { data: url, isLoading, isError } = useSignedMedia(message.media_path);
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
      ) : (
        <video src={url} controls playsInline className="w-64 max-w-full rounded-xl" />
      )}
      <span className="mt-1 block text-[10px] opacity-70">
        {message.kind === "audio" ? "Голосовое" : "Видео"} · {formatTime(message.duration_seconds)}
      </span>
    </div>
  );
}

function BuddyPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const qc = useQueryClient();
  const award = useServerFn(awardCoins);

  const [status, setStatus] = useState(profile?.life_status ?? "other");
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recorder, setRecorder] = useState<MediaKind | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: match, isLoading: matchLoading } = useActiveMatch(searching);
  const { data: messages = [] } = useBuddyMessages(match?.match_id ?? null);

  useEffect(() => {
    if (profile?.life_status) setStatus(profile.life_status);
  }, [profile?.life_status]);

  useEffect(() => {
    if (match && searching) {
      setSearching(false);
      toast.success(`Мы нашли собеседницу: ${match.partner_name}`);
    }
  }, [match, searching]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, match?.match_id]);

  const refreshMatch = () => qc.invalidateQueries({ queryKey: ["buddy", "match"] });

  const startSearch = async () => {
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc("find_or_queue_buddy", { _life_status: status });
      if (error) throw error;
      const row = data?.[0];
      if (row?.matched) {
        await refreshMatch();
        setSearching(false);
      } else {
        toast("Вы в очереди — как только появится собеседница, мы соединим вас");
      }
    } catch {
      setSearching(false);
      toast.error("Не удалось начать поиск", {
        action: { label: "Повторить", onClick: () => void startSearch() },
      });
    }
  };

  const cancelSearch = async () => {
    setSearching(false);
    try {
      await supabase.rpc("leave_buddy_queue");
      toast("Поиск отменён");
    } catch {
      toast.error("Не удалось отменить поиск");
    }
  };

  const leaveMatch = async () => {
    if (!match) return;
    try {
      const { error } = await supabase.rpc("leave_buddy_match", {
        _match_id: match.match_id,
        _block: false,
      });
      if (error) throw error;
      await refreshMatch();
      toast("Разговор завершён. Можно найти новую собеседницу");
    } catch {
      toast.error("Не удалось завершить разговор");
    }
  };

  const grantCoins = async () => {
    try {
      const res = await award({ data: { action: "buddy" } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      if (res.reason === "granted") toast.success(`+${res.granted} Nur-Coins за поддержку`);
    } catch {
      /* монеты не критичны для отправки сообщения */
    }
  };

  const sendText = async (value: string) => {
    if (!match || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("buddy_messages").insert({
        match_id: match.match_id,
        sender_id: user.id,
        kind: "text",
        body: value,
      });
      if (error) throw error;
      setText("");
      await qc.invalidateQueries({ queryKey: ["buddy", "messages", match.match_id] });
      void grantCoins();
    } catch {
      toast.error("Сообщение не отправлено", {
        action: { label: "Повторить", onClick: () => void sendText(value) },
      });
    } finally {
      setSending(false);
    }
  };

  const sendMedia = async (kind: MediaKind, blob: Blob, mime: string, duration: number) => {
    if (!match || !user) return;
    setSending(true);
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const path = `${match.match_id}/${user.id}-${Date.now()}.${ext}`;
    try {
      await uploadWithRetry("buddy-media", path, blob, mime, { attempts: 3, timeoutMs: 90_000 });
      const { error } = await supabase.from("buddy_messages").insert({
        match_id: match.match_id,
        sender_id: user.id,
        kind,
        media_path: path,
        duration_seconds: duration,
      });
      if (error) throw error;
      setRecorder(null);
      await qc.invalidateQueries({ queryKey: ["buddy", "messages", match.match_id] });
      void grantCoins();
    } catch {
      toast.error("Не удалось отправить сообщение. Запись сохранена — попробуйте ещё раз");
    } finally {
      setSending(false);
    }
  };

  const submitReport = async () => {
    if (!match) return;
    try {
      const { error } = await supabase.rpc("report_buddy", {
        _match_id: match.match_id,
        _reason: reportReason,
        _details: reportDetails.slice(0, 1000),
      });
      if (error) throw error;
      setReportOpen(false);
      setReportDetails("");
      await refreshMatch();
      toast.success("Жалоба отправлена на модерацию. Разговор завершён, эта собеседница больше не встретится");
    } catch {
      toast.error("Не удалось отправить жалобу. Попробуйте ещё раз");
    }
  };

  const partnerStatus = lifeStatuses.find((s) => s.id === match?.partner_status);

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
                disabled={!!match}
                className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors disabled:opacity-60 ${
                  status === s.id ? "border-primary bg-primary-soft" : "border-border hover:bg-secondary"
                }`}
              >
                <span className="shrink-0 text-lg">{s.emoji}</span>
                <span className="min-w-0">{s.label}</span>
              </button>
            ))}
          </div>

          {match ? (
            <Button variant="secondary" className="mt-4 w-full" onClick={() => void leaveMatch()}>
              <Shuffle className="size-4" /> Завершить разговор
            </Button>
          ) : searching ? (
            <Button variant="secondary" className="mt-4 w-full" onClick={() => void cancelSearch()}>
              <Loader2 className="size-4 animate-spin" /> Ищем… отменить
            </Button>
          ) : (
            <Button className="mt-4 w-full" onClick={() => void startSearch()}>
              <Search className="size-4" /> Найти собеседницу
            </Button>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Сначала подбираем собеседницу с таким же жизненным статусом. Если сейчас никого нет,
            поиск автоматически расширяется на смежные статусы.
          </p>

          <div className="mt-6 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
            Разговоры приватные. Жалоба сразу завершает разговор и отправляет переписку модерации,
            а собеседница больше не появится в подборе.
          </div>
        </section>

        <section className="surface flex min-h-[560px] min-w-0 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold">
                {match ? match.partner_name.slice(0, 1) : "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {match ? match.partner_name : "Собеседница не выбрана"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {match
                    ? `Приватная комната 1-на-1${partnerStatus ? ` · ${partnerStatus.label}` : ""}`
                    : "Начните поиск, чтобы открыть комнату"}
                </p>
              </div>
            </div>
            {match ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => void leaveMatch()}>
                  <Shuffle className="size-4" /> Сменить
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setReportOpen(true)}
                >
                  <ShieldAlert className="size-4" /> Пожаловаться
                </Button>
              </div>
            ) : null}
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {matchLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Загружаем…</p>
            ) : !match ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div className="max-w-sm">
                  <p className="font-display text-lg">Здесь появится ваш разговор</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {searching
                      ? "Ищем собеседницу с похожим опытом. Можно оставить страницу открытой — мы соединим вас автоматически."
                      : "Выберите категорию слева и нажмите «Найти собеседницу»."}
                  </p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Напишите первое сообщение — например, как прошёл ваш день.
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {m.kind === "text" ? m.body : <MediaBubble message={m} mine={mine} />}
                      <span className="mt-1 block text-[10px] opacity-70">
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

          {match && recorder ? (
            <div className="border-t border-border p-3">
              <MediaMessageRecorder
                kind={recorder}
                busy={sending}
                onCancel={() => setRecorder(null)}
                onSend={(blob, mime, duration) => sendMedia(recorder, blob, mime, duration)}
              />
            </div>
          ) : null}

          <form
            className="flex items-center gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = text.trim();
              if (!value || sending || !match) return;
              void sendText(value);
            }}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Голосовое сообщение"
              disabled={!match || sending}
              onClick={() => setRecorder("audio")}
            >
              <Mic className="size-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Видео-сообщение"
              disabled={!match || sending}
              onClick={() => setRecorder("video")}
            >
              <Video className="size-5" />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={match ? "Напишите слова поддержки…" : "Сначала найдите собеседницу"}
              disabled={!match || sending}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Отправить"
              disabled={!match || !text.trim() || sending}
            >
              <Send className="size-4" />
            </Button>
          </form>
        </section>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пожаловаться на собеседницу</DialogTitle>
            <DialogDescription>
              Разговор будет завершён, а жалоба уйдёт модерации. Эта собеседница больше не появится
              в подборе.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReportReason(r.id)}
                className={`flex w-full items-center rounded-xl border p-3 text-left text-sm ${
                  reportReason === r.id ? "border-primary bg-primary-soft" : "border-border"
                }`}
              >
                {r.label}
              </button>
            ))}
            <Textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Что произошло? (необязательно)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={() => void submitReport()}>
              Отправить жалобу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
