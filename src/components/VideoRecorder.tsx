import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Circle, Pause, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RecordingResult = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  thumbnail: Blob | null;
  previewUrl: string;
};

export type RecorderState =
  | "unsupported"
  | "idle"
  | "requesting"
  | "ready"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

const STATE_LABEL: Record<RecorderState, string> = {
  unsupported: "Недоступно",
  idle: "Камера выключена",
  requesting: "Запрашиваем доступ…",
  ready: "Готово к записи",
  recording: "Идёт запись",
  paused: "Пауза",
  stopped: "Запись остановлена",
  error: "Ошибка",
};

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
}

function describeMediaError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  const msg = ((err as { message?: string } | null)?.message ?? "").toLowerCase();
  if (msg.includes("denied") || msg.includes("dismissed")) return describeMediaError({ name: "NotAllowedError" });
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Доступ к камере и микрофону запрещён. Разрешите его в настройках браузера (значок замка в адресной строке) и попробуйте снова.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Камера или микрофон не найдены. Подключите устройство и попробуйте снова.";
    case "NotReadableError":
    case "AbortError":
      return "Камера занята другим приложением. Закройте его и попробуйте снова.";
    default:
      return "Не удалось включить камеру. Обновите страницу и попробуйте снова.";
  }
}

export function formatTime(total: number) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Props = {
  maxSeconds: number;
  /** Fires once when a recording is finalised. */
  onRecorded: (result: RecordingResult) => void;
  /** Fires when the user discards the current recording. */
  onDiscard: () => void;
  /** Lock the controls (e.g. while uploading). */
  locked?: boolean;
  onStateChange?: (state: RecorderState) => void;
};

export function VideoRecorder({ maxSeconds, onRecorded, onDiscard, locked, onStateChange }: Props) {
  const [state, setStateRaw] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const thumbRef = useRef<Blob | null>(null);
  const mimeRef = useRef("");
  const startedAtRef = useRef(0); // wall clock of current running segment
  const accumulatedRef = useRef(0); // seconds recorded before current segment
  const tickRef = useRef<number | null>(null);
  const stateRef = useRef<RecorderState>("idle");

  const setState = useCallback(
    (s: RecorderState) => {
      stateRef.current = s;
      setStateRaw(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  const currentElapsed = () =>
    accumulatedRef.current +
    (startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0);

  const stopTicker = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
    }
    return () => {
      stopTicker();
      try {
        recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const attachLive = () => {
    const v = videoRef.current;
    if (!v || !streamRef.current) return;
    if (v.srcObject !== streamRef.current) v.srcObject = streamRef.current;
    v.muted = true;
    v.play().catch(() => {});
  };

  // Keep the live <video> bound to the stream whenever it is on screen.
  useEffect(() => {
    if (state === "ready" || state === "recording" || state === "paused") attachLive();
  }, [state]);

  const enableCamera = async () => {
    setError(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      mimeRef.current = pickMimeType();
      if (!mimeRef.current) {
        stopStream();
        setError("Этот браузер не умеет записывать видео. Попробуйте актуальный Chrome, Safari или Firefox.");
        setState("error");
        return;
      }
      setState("ready");
      // attach after render
      setTimeout(attachLive, 0);
    } catch (err) {
      setError(describeMediaError(err));
      setState("error");
    }
  };

  const captureThumbnail = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    const w = 480;
    canvas.width = w;
    canvas.height = Math.round((v.videoHeight / v.videoWidth) * w);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (b) => {
        if (b) thumbRef.current = b;
      },
      "image/jpeg",
      0.75,
    );
  };

  const finalize = () => {
    stopTicker();
    const duration = Math.max(1, Math.round(currentElapsed()));
    startedAtRef.current = 0;
    accumulatedRef.current = duration;
    setElapsed(duration);
    const type = mimeRef.current.split(";")[0] || "video/webm";
    const blob = new Blob(chunksRef.current, { type });
    if (!blob.size) {
      setError("Запись получилась пустой. Попробуйте записать ещё раз.");
      setState("error");
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setState("stopped");
    onRecorded({ blob, mimeType: type, durationSeconds: duration, thumbnail: thumbRef.current, previewUrl: url });
  };

  const startTicker = () => {
    stopTicker();
    tickRef.current = window.setInterval(() => {
      const e = currentElapsed();
      setElapsed(e);
      if (e >= maxSeconds) stopRecording();
    }, 250);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    try {
      chunksRef.current = [];
      thumbRef.current = null;
      accumulatedRef.current = 0;
      const rec = new MediaRecorder(streamRef.current, { mimeType: mimeRef.current });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      rec.onerror = () => {
        stopTicker();
        setError("Во время записи произошла ошибка. Запись остановлена — попробуйте ещё раз.");
        setState("error");
      };
      rec.onstop = finalize;
      recorderRef.current = rec;
      rec.start(1000);
      startedAtRef.current = Date.now();
      setElapsed(0);
      setState("recording");
      startTicker();
      window.setTimeout(captureThumbnail, 1200);
    } catch (err) {
      setError(describeMediaError(err));
      setState("error");
    }
  };

  const pauseRecording = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    accumulatedRef.current = currentElapsed();
    startedAtRef.current = 0;
    stopTicker();
    setState("paused");
  };

  const resumeRecording = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "paused") return;
    rec.resume();
    startedAtRef.current = Date.now();
    setState("recording");
    startTicker();
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    if (!thumbRef.current) captureThumbnail();
    stopTicker();
    if (rec.state === "paused") {
      // elapsed already accumulated
    } else {
      accumulatedRef.current = currentElapsed();
      startedAtRef.current = 0;
    }
    rec.stop();
  };

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    chunksRef.current = [];
    thumbRef.current = null;
    accumulatedRef.current = 0;
    startedAtRef.current = 0;
    setElapsed(0);
    onDiscard();
    if (streamRef.current) {
      setState("ready");
      setTimeout(attachLive, 0);
    } else {
      setState("idle");
    }
  };

  const retryAfterError = () => {
    stopStream();
    chunksRef.current = [];
    setElapsed(0);
    onDiscard();
    enableCamera();
  };

  const showLive = state === "ready" || state === "recording" || state === "paused";

  return (
    <section className="surface overflow-hidden">
      <div className="relative aspect-[4/3] bg-foreground/90">
        {showLive ? (
          <video ref={videoRef} className="size-full object-cover" playsInline muted autoPlay />
        ) : null}
        {state === "stopped" && previewUrl ? (
          <video src={previewUrl} className="size-full object-cover" playsInline controls />
        ) : null}

        {(state === "idle" || state === "requesting" || state === "unsupported" || state === "error") && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-background/85">
            <div className="max-w-sm">
              {state === "error" || state === "unsupported" ? (
                <>
                  <AlertTriangle className="mx-auto size-8 text-accent" />
                  <p className="mt-3 text-sm">
                    {error ??
                      "Этот браузер не поддерживает запись видео. Откройте приложение в Chrome или Safari."}
                  </p>
                </>
              ) : state === "requesting" ? (
                <>
                  <Camera className="mx-auto size-8 animate-pulse" />
                  <p className="mt-3 text-sm">Разрешите доступ к камере и микрофону в окне браузера</p>
                </>
              ) : (
                <>
                  <Camera className="mx-auto size-8" />
                  <p className="mt-3 font-display text-lg">Камера выключена</p>
                  <p className="mt-1 text-sm opacity-70">
                    Включите камеру, чтобы записать до {Math.round(maxSeconds / 60)} минут о своём дне
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold">
          <span
            className={`size-2 rounded-full ${
              state === "recording"
                ? "animate-pulse bg-destructive"
                : state === "error"
                  ? "bg-accent"
                  : state === "ready" || state === "stopped"
                    ? "bg-primary"
                    : "bg-muted-foreground"
            }`}
          />
          {STATE_LABEL[state]}
        </span>
        <span className="absolute right-4 top-4 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold tabular-nums">
          {formatTime(elapsed)} / {formatTime(maxSeconds)}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 p-5">
        {state === "idle" || state === "requesting" ? (
          <Button size="lg" onClick={enableCamera} disabled={state === "requesting"} className="gap-2">
            <Camera className="size-4" /> Включить камеру
          </Button>
        ) : null}

        {state === "error" || state === "unsupported" ? (
          <Button size="lg" onClick={retryAfterError} disabled={state === "unsupported"} className="gap-2">
            <RotateCcw className="size-4" /> Попробовать снова
          </Button>
        ) : null}

        {state === "ready" ? (
          <Button size="lg" onClick={startRecording} className="gap-2">
            <Circle className="size-4 fill-current" /> Начать запись
          </Button>
        ) : null}

        {state === "recording" ? (
          <>
            <Button size="lg" variant="secondary" onClick={pauseRecording}>
              <Pause className="size-4" /> Пауза
            </Button>
            <Button size="lg" onClick={stopRecording}>
              <Square className="size-4 fill-current" /> Остановить
            </Button>
          </>
        ) : null}

        {state === "paused" ? (
          <>
            <Button size="lg" onClick={resumeRecording} className="gap-2">
              <Play className="size-4 fill-current" /> Продолжить
            </Button>
            <Button size="lg" variant="secondary" onClick={stopRecording}>
              <Square className="size-4 fill-current" /> Остановить
            </Button>
          </>
        ) : null}

        {state === "stopped" ? (
          <Button size="lg" variant="ghost" onClick={discard} disabled={locked}>
            <RotateCcw className="size-4" /> Перезаписать
          </Button>
        ) : null}
      </div>
    </section>
  );
}
