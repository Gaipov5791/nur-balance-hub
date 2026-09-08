import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Circle, RotateCcw, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/components/VideoRecorder";

export type MediaKind = "audio" | "video";

type State = "idle" | "requesting" | "ready" | "recording" | "stopped" | "error";

const LABEL: Record<State, string> = {
  idle: "Готовим запись…",
  requesting: "Запрашиваем доступ…",
  ready: "Готово к записи",
  recording: "Идёт запись",
  stopped: "Запись готова",
  error: "Ошибка",
};

function pickMime(kind: MediaKind): string {
  const candidates =
    kind === "audio"
      ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
}

function describe(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Доступ к микрофону или камере запрещён. Разрешите его в настройках браузера и попробуйте снова.";
  if (name === "NotFoundError") return "Микрофон или камера не найдены. Подключите устройство.";
  if (name === "NotReadableError") return "Устройство занято другим приложением. Закройте его и попробуйте снова.";
  return "Не удалось начать запись. Попробуйте ещё раз.";
}

type Props = {
  kind: MediaKind;
  maxSeconds?: number;
  busy?: boolean;
  onSend: (blob: Blob, mimeType: string, durationSeconds: number) => void | Promise<void>;
  onCancel: () => void;
};

/** Compact recorder for chat voice/video messages. Reuses the journal recording mechanics. */
export function MediaMessageRecorder({ kind, maxSeconds = 60, busy, onSend, onCancel }: Props) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resultRef = useRef<{ blob: Blob; mime: string; duration: number } | null>(null);
  const mimeRef = useRef("");
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);

  const stopTicker = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    stopTicker();
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "audio" ? { audio: true } : { audio: true, video: { facingMode: "user" } },
      );
      streamRef.current = stream;
      mimeRef.current = pickMime(kind);
      if (!mimeRef.current) {
        stopStream();
        setError("Этот браузер не умеет записывать такие сообщения. Попробуйте Chrome или Safari.");
        setState("error");
        return;
      }
      setState("ready");
      if (kind === "video") {
        setTimeout(() => {
          const v = videoRef.current;
          if (!v || !streamRef.current) return;
          v.srcObject = streamRef.current;
          v.muted = true;
          v.play().catch(() => {});
        }, 0);
      }
    } catch (err) {
      setError(describe(err));
      setState("error");
    }
  }, [kind]);

  useEffect(() => {
    void enable();
    return () => {
      stopTicker();
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      } catch {
        /* ignore */
      }
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const start = () => {
    if (!streamRef.current) return;
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(streamRef.current, { mimeType: mimeRef.current });
      rec.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      rec.onerror = () => {
        stopTicker();
        setError("Во время записи произошла ошибка. Попробуйте ещё раз.");
        setState("error");
      };
      rec.onstop = () => {
        stopTicker();
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const type = mimeRef.current.split(";")[0] || (kind === "audio" ? "audio/webm" : "video/webm");
        const blob = new Blob(chunksRef.current, { type });
        if (!blob.size) {
          setError("Запись получилась пустой. Попробуйте ещё раз.");
          setState("error");
          return;
        }
        resultRef.current = { blob, mime: type, duration };
        setElapsed(duration);
        setPreviewUrl(URL.createObjectURL(blob));
        setState("stopped");
      };
      recorderRef.current = rec;
      rec.start(500);
      startedAtRef.current = Date.now();
      setElapsed(0);
      setState("recording");
      tickRef.current = window.setInterval(() => {
        const e = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(e);
        if (e >= maxSeconds) stop();
      }, 250);
    } catch (err) {
      setError(describe(err));
      setState("error");
    }
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    resultRef.current = null;
    setElapsed(0);
    setState(streamRef.current ? "ready" : "idle");
    if (!streamRef.current) void enable();
  };

  const send = async () => {
    const r = resultRef.current;
    if (!r) return;
    await onSend(r.blob, r.mime, r.duration);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span
            className={`size-2 rounded-full ${
              state === "recording"
                ? "animate-pulse bg-destructive"
                : state === "error"
                  ? "bg-accent"
                  : "bg-primary"
            }`}
          />
          {kind === "audio" ? "Голосовое сообщение" : "Видео-сообщение"} · {LABEL[state]}
        </span>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {formatTime(elapsed)} / {formatTime(maxSeconds)}
        </span>
      </div>

      {kind === "video" ? (
        <div className="mt-3 aspect-video overflow-hidden rounded-xl bg-foreground/90">
          {state === "stopped" && previewUrl ? (
            <video src={previewUrl} className="size-full object-cover" controls playsInline />
          ) : (
            <video ref={videoRef} className="size-full object-cover" muted playsInline autoPlay />
          )}
        </div>
      ) : state === "stopped" && previewUrl ? (
        <audio src={previewUrl} controls className="mt-3 w-full" />
      ) : null}

      {error ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Отмена
        </Button>
        {state === "error" ? (
          <Button type="button" size="sm" onClick={() => void enable()}>
            <RotateCcw className="size-4" /> Попробовать снова
          </Button>
        ) : null}
        {state === "ready" ? (
          <Button type="button" size="sm" onClick={start}>
            <Circle className="size-4 fill-current" /> Начать запись
          </Button>
        ) : null}
        {state === "recording" ? (
          <Button type="button" size="sm" onClick={stop}>
            <Square className="size-4 fill-current" /> Остановить
          </Button>
        ) : null}
        {state === "stopped" ? (
          <>
            <Button type="button" variant="secondary" size="sm" onClick={retake} disabled={busy}>
              <RotateCcw className="size-4" /> Перезаписать
            </Button>
            <Button type="button" size="sm" onClick={() => void send()} disabled={busy}>
              <Send className="size-4" /> {busy ? "Отправляем…" : "Отправить"}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
