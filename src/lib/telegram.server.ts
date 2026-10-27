// Server-only Telegram Bot API helpers. Never import from client components.
import { APP_URL, buildTelegramMessage, type OutboxKind, type TgMessage } from "@/lib/telegram";

function botToken(): string {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

export class TelegramError extends Error {
  constructor(
    public status: number,
    public description: string,
  ) {
    super(`Telegram [${status}]: ${description}`);
  }
}

export async function telegramApi<T = unknown>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json().catch(() => null)) as
    | { ok: boolean; result?: T; description?: string; error_code?: number }
    | null;
  if (!res.ok || !json?.ok) {
    throw new TelegramError(json?.error_code ?? res.status, json?.description ?? "request failed");
  }
  return json.result as T;
}

export async function sendTelegram(chatId: number, msg: TgMessage) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text: msg.text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(msg.button
      ? { reply_markup: { inline_keyboard: [[{ text: msg.button.text, url: msg.button.url }]] } }
      : {}),
  });
}

let cachedUsername: string | null = null;
export async function botUsername(): Promise<string> {
  if (cachedUsername) return cachedUsername;
  const me = await telegramApi<{ username: string }>("getMe", {});
  cachedUsername = me.username;
  return me.username;
}

/** Secret Telegram sends back in X-Telegram-Bot-Api-Secret-Token. */
export async function webhookSecret(): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`telegram-webhook:${botToken()}`).digest("base64url");
}

type OutboxRow = {
  id: string;
  therapist_id: string;
  request_id: string | null;
  kind: string;
  payload: unknown;
};

export type FlushResult = { claimed: number; sent: number; skipped: number; failed: number };

export async function flushTelegramOutbox(limit = 25): Promise<FlushResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: FlushResult = { claimed: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: rows, error } = await supabaseAdmin.rpc("claim_telegram_outbox", { _limit: limit });
  if (error) throw new Error(`claim_telegram_outbox: ${error.message}`);
  const list = (rows ?? []) as OutboxRow[];
  result.claimed = list.length;

  for (const row of list) {
    const finish = (patch: Record<string, unknown>) =>
      supabaseAdmin.from("telegram_outbox").update(patch).eq("id", row.id);

    try {
      const { data: link } = await supabaseAdmin
        .from("therapist_telegram")
        .select("chat_id")
        .eq("therapist_id", row.therapist_id)
        .maybeSingle();
      if (!link) {
        await finish({ status: "skipped", last_error: "not linked" });
        result.skipped += 1;
        continue;
      }

      let request = null;
      let chatUrl: string | null = null;
      if (row.request_id) {
        const { data } = await supabaseAdmin
          .from("therapist_requests")
          .select("client_name, preferred_time, topic, status, duration_minutes, scheduled_at")
          .eq("id", row.request_id)
          .maybeSingle();
        request = data;
        if (row.kind === "reminder_1h") {
          const { data: chat } = await supabaseAdmin
            .from("therapist_chats")
            .select("id")
            .eq("request_id", row.request_id)
            .maybeSingle();
          if (chat) chatUrl = `${APP_URL}/therapy-chat?chat=${chat.id}`;
        }
      }

      const msg = buildTelegramMessage(
        row.kind as OutboxKind,
        request,
        (row.payload ?? {}) as Record<string, unknown>,
        chatUrl,
      );
      if (!msg) {
        await finish({ status: "skipped", last_error: "not relevant" });
        result.skipped += 1;
        continue;
      }

      await sendTelegram(Number(link.chat_id), msg);
      await finish({ status: "sent", sent_at: new Date().toISOString(), last_error: null });
      result.sent += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Telegram send failed for outbox ${row.id}: ${message}`);
      // Bot blocked or chat gone: stop retrying and drop the stale link.
      if (e instanceof TelegramError && (e.status === 403 || e.status === 400)) {
        await finish({ status: "failed", last_error: message });
        if (e.status === 403) {
          await supabaseAdmin.from("therapist_telegram").delete().eq("therapist_id", row.therapist_id);
        }
      } else {
        await finish({ status: "pending", last_error: message });
      }
      result.failed += 1;
    }
  }
  return result;
}

export async function runTelegramReminders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: queued, error } = await supabaseAdmin.rpc("enqueue_telegram_reminders");
  if (error) throw new Error(`enqueue_telegram_reminders: ${error.message}`);
  const flushed = await flushTelegramOutbox(50);
  return { queued: queued ?? 0, ...flushed };
}
