import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Mic, RefreshCw, Save, Video } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoinsPanel, TipPanel } from "@/components/panels";
import { ReminderInline } from "@/components/ReminderInline";
import { VideoRecorder, formatTime, type RecordingResult, type RecorderState } from "@/components/VideoRecorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { moodKeys, moods, type MoodKey } from "@/data/demo";
import { useAuth } from "@/hooks/useAuth";
import { createJournalEntry, MAX_RECORD_SECONDS, VIDEO_BUCKET } from "@/lib/journal.functions";
import { localDateString, uploadWithRetry } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Видео-дневник эмоций — Nur Balance" },
      {
        name: "description",
        content:
          "Запишите короткое видео о своём дне, отметьте эмоцию по шкале от 1 до 5 и получите +10 Nur-Coins.",
      },
      { property: "og:title", content: "Видео-дневник эмоций — Nur Balance" },
      {
        property: "og:description",
        content: "Запись до 3 минут, метка настроения и продолжение вашей серии дней.",
      },
    ],
  }),
  component: JournalPage,
  errorComponent: ({ error, reset }) => (
    <AppShell title="Видео-дневник">
      <div className="surface p-6 text-center">
        <p className="font-semibold">Страница дневника не загрузилась</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-4" onClick={reset}>
          Попробовать снова
        </Button>
      </div>
    </AppShell>
  ),
});

type SaveStep = "idle" | "uploading" | "saving" | "done" | "failed";

function extFor(mime: string) {
  if (mime.startsWith("audio/")) {
    if (mime.includes("mp4")) return "m4a";
    if (mime.includes("ogg")) return "ogg";
    return "weba";
  }
  return mime.includes("mp4") ? "mp4" : "webm";
}

function JournalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createEntry = useServerFn(createJournalEntry);

  const [recordMode, setRecordMode] = useState<"video" | "audio">("video");
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [recording, setRecording] = useState<RecordingResult | null>(null);
  const [mood, setMood] = useState<MoodKey | null>(null);
  const [level, setLevel] = useState(3);
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [step, setStep] = useState<SaveStep>("idle");
  const [progressText, setProgressText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  // Remember uploaded paths so a retry after a server error doesn't re-upload.
  const [uploaded, setUploaded] = useState<{ video: string; thumb: string | null } | null>(null);

  const busy = step === "uploading" || step === "saving";
  const hasUnsaved = !!recording && step !== "done";

  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  const resetForm = () => {
    setRecording(null);
    setUploaded(null);
    setStep("idle");
    setSaveError(null);
    setProgressText("");
  };

  const downloadRecording = () => {
    if (!recording) return;
    const a = document.createElement("a");
    a.href = recording.previewUrl;
    a.download = `nur-balance-${localDateString()}.${extFor(recording.mimeType)}`;
    a.click();
  };

  const save = async () => {
    if (!recording || !mood || !user) return;
    setSaveError(null);
    try {
      let paths = uploaded;
      if (!paths) {
        setStep("uploading");
        const base = `${user.id}/${Date.now()}-${crypto.randomUUID()}`;
        const videoPath = `${base}.${extFor(recording.mimeType)}`;
        await uploadWithRetry(VIDEO_BUCKET, videoPath, recording.blob, recording.mimeType, {
          onAttempt: (a, t) =>
            setProgressText(a === 1 ? "Загружаем видео…" : `Повторная попытка ${a} из ${t}…`),
        });
        let thumbPath: string | null = null;
        if (recording.thumbnail) {
          try {
            thumbPath = await uploadWithRetry(VIDEO_BUCKET, `${base}.jpg`, recording.thumbnail, "image/jpeg", {
              attempts: 2,
              timeoutMs: 30_000,
            });
          } catch (err) {
            console.warn("thumbnail upload skipped", err);
            thumbPath = null; // a missing thumbnail must not block the entry
          }
        }
        paths = { video: videoPath, thumb: thumbPath };
        setUploaded(paths);
      }

      setStep("saving");
      setProgressText("Сохраняем запись…");
      const result = await createEntry({
        data: {
          entryDate: localDateString(),
          mood,
          level,
          note: note.trim(),
          durationSeconds: recording.durationSeconds,
          videoPath: paths.video,
          thumbnailPath: paths.thumb,
          mimeType: recording.mimeType,
          fileSize: recording.blob.size,
        },
      });
      setStep("done");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["journal"] });
      toast.success(
        result.total > 0
          ? `Запись сохранена. +${result.total} Nur-Coins`
          : "Запись сохранена. Дневной лимит монет уже набран",
      );
    } catch (err) {
      setStep("failed");
      setSaveError(err instanceof Error ? err.message : "Неизвестная ошибка");
    }
  };

  return (
    <AppShell
      title="Видео-дневник"
      aside={
        <>
          <CoinsPanel />
          <TipPanel />
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="surface flex flex-wrap items-center gap-2 p-2">
            {([
              { id: "video" as const, label: "Видео", icon: Video },
              { id: "audio" as const, label: "Только голос", icon: Mic },
            ]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  if (recordMode === opt.id) return;
                  setRecordMode(opt.id);
                  resetForm();
                }}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                  recordMode === opt.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                }`}
              >
                <opt.icon className="size-4 shrink-0" />
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
          <VideoRecorder
            key={recordMode}
            mode={recordMode}
            maxSeconds={MAX_RECORD_SECONDS}
            locked={busy}
            onStateChange={setRecorderState}
            onRecorded={(r) => {
              setRecording(r);
              setUploaded(null);
              setStep("idle");
              setSaveError(null);
            }}
            onDiscard={resetForm}
          />
          <ReminderInline />
          {step === "failed" && saveError ? (
            <div className="surface border-destructive/40 p-4">
              <p className="text-sm font-semibold text-destructive">Не удалось сохранить запись</p>
              <p className="mt-1 text-sm text-muted-foreground">{saveError}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Видео осталось на этом экране — ничего не потеряно. Проверьте интернет и повторите.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={save}>
                  <RefreshCw className="size-4" /> Повторить
                </Button>
                <Button size="sm" variant="secondary" onClick={downloadRecording}>
                  <Download className="size-4" /> Скачать запись
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <section className="surface p-5">
          {step === "done" ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-10 text-primary" />
              <h2 className="mt-3 font-display text-base">Запись сохранена</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Она уже в вашем календаре и доступна только вам.
              </p>
              <div className="mt-5 grid gap-2">
                <Button onClick={() => navigate({ to: "/archive" })}>Открыть календарь</Button>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Записать ещё
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-display text-base">Как вы себя чувствуете?</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {moodKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    onClick={() => setMood(key)}
                    className={`flex items-center gap-2 rounded-2xl border p-3 text-left text-sm transition-colors ${
                      mood === key
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-secondary/50 hover:bg-secondary"
                    }`}
                  >
                    <span className="shrink-0 text-xl">{moods[key].emoji}</span>
                    <span className="min-w-0 truncate">{moods[key].label}</span>
                  </button>
                ))}
              </div>

              <p className="mt-5 text-sm font-medium">Интенсивность состояния</p>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={busy}
                    onClick={() => setLevel(n)}
                    className={`h-11 flex-1 rounded-xl text-sm font-semibold transition-colors ${
                      level === n
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-primary-soft"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <Textarea
                className="mt-5 min-h-24"
                placeholder="Короткая заметка к записи (необязательно)"
                value={note}
                maxLength={2000}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
              />

              <Button
                className="mt-4 w-full"
                size="lg"
                disabled={!mood || !recording || busy}
                onClick={() => setConfirmOpen(true)}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {busy ? progressText : "Сохранить запись"}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {!recording
                  ? recorderState === "recording" || recorderState === "paused"
                    ? "Остановите запись, чтобы сохранить её"
                    : recordMode === "audio"
                      ? "Сначала запишите голос"
                      : "Сначала запишите видео"
                  : !mood
                    ? "Выберите эмоцию, чтобы сохранить"
                    : "Записи видны только вам."}{" "}
                <Link to="/settings" className="text-primary hover:underline">
                  Настройки приватности
                </Link>
              </p>
            </>
          )}
        </section>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить запись?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <p>
                  {recordMode === "audio" ? "Голосовая запись" : "Видео"}{" "}
                  {recording ? formatTime(recording.durationSeconds) : ""}
                  {recording ? ` · ${(recording.blob.size / 1024 / 1024).toFixed(1)} МБ` : ""}
                </p>
                <p>
                  Эмоция: {mood ? `${moods[mood].emoji} ${moods[mood].label}` : "—"} · интенсивность {level}/5
                </p>
                <p className="text-muted-foreground">
                  Запись будет зашифрованно загружена в ваш личный архив. Её увидите только вы.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Вернуться</AlertDialogCancel>
            <AlertDialogAction onClick={save}>Отправить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
