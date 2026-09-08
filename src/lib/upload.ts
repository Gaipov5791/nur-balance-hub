import { supabase } from "@/integrations/supabase/client";

export class UploadError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
  ) {
    super(message);
  }
}

type Options = {
  attempts?: number;
  timeoutMs?: number;
  onAttempt?: (attempt: number, total: number) => void;
};

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label}: превышено время ожидания`)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Uploads a blob to a private bucket, retrying transient failures with backoff. */
export async function uploadWithRetry(
  bucket: string,
  path: string,
  blob: Blob,
  contentType: string,
  { attempts = 3, timeoutMs = 120_000, onAttempt }: Options = {},
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    onAttempt?.(attempt, attempts);
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("Нет соединения с интернетом");
      }
      const { error } = await withTimeout(
        supabase.storage.from(bucket).upload(path, blob, { contentType, upsert: true }),
        timeoutMs,
        "Загрузка",
      );
      if (error) throw error;
      return path;
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  const msg = lastError instanceof Error ? lastError.message : "неизвестная ошибка";
  throw new UploadError(`Не удалось загрузить файл (${msg})`, attempts);
}

export function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
