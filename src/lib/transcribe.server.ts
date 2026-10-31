// Server-only: transcribes journal audio/video via the Lovable AI Gateway and caches the text on the entry.
const MODEL = "openai/gpt-transcribe";
const MAX_BYTES = 24 * 1024 * 1024;
const BUCKET = "journal-videos";

type Entry = { id: string; video_path: string | null; mime_type: string | null; transcript: string | null; transcript_status: string | null };

async function readTranscript(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("empty stream");
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let final: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload) as { type?: string; delta?: string; text?: string; error?: { message?: string } };
        if (ev.type === "transcript.text.delta" && ev.delta) text += ev.delta;
        else if (ev.type === "transcript.text.done" && typeof ev.text === "string") final = ev.text;
        else if (ev.error) throw new Error(ev.error.message ?? "transcription error");
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  if (final === null && !text) throw new Error("incomplete transcript");
  return (final ?? text).trim();
}

/** Transcribes one entry (if it has media and no transcript yet). Never throws; returns the transcript or null. */
export async function ensureTranscript(admin: any, entry: Entry): Promise<string | null> {
  if (entry.transcript !== null) return entry.transcript;
  if (!entry.video_path || entry.transcript_status === "failed") return null;
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;
  try {
    const { data: blob, error } = await admin.storage.from(BUCKET).download(entry.video_path);
    if (error || !blob) throw new Error("download failed");
    if (!blob.size || blob.size > MAX_BYTES) throw new Error("file too large");
    const mime = entry.mime_type || blob.type || "video/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("model", MODEL);
    form.append("file", new File([blob], `entry.${ext}`, { type: mime }));
    form.append("response_format", "json");
    form.append("stream", "true");
    form.append("languages", "ru");
    form.append("languages", "kk");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // 429/5xx are transient: leave status empty so a later analysis retries.
      const transient = res.status === 429 || res.status >= 500;
      console.error("transcribe failed", res.status, body.slice(0, 300));
      if (!transient) await admin.from("journal_entries").update({ transcript_status: "failed" }).eq("id", entry.id);
      return null;
    }
    const transcript = await readTranscript(res);
    await admin.from("journal_entries").update({ transcript, transcript_status: "done" }).eq("id", entry.id);
    return transcript;
  } catch (e) {
    console.error("transcribe error", e instanceof Error ? e.message : e);
    return null;
  }
}
