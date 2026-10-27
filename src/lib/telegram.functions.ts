import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Creates a one-time deep link that connects the caller's therapist card to Telegram. */
export const getTelegramConnectLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: code, error } = await context.supabase.rpc("create_telegram_link_code");
    if (error || !code) throw new Error("Кабинет специалиста не найден");
    const { botUsername } = await import("@/lib/telegram.server");
    const username = await botUsername();
    return { url: `https://t.me/${username}?start=${code}`, username };
  });

/** Sends a test message to the caller's linked Telegram chat. */
export const sendTelegramTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: card } = await context.supabase
      .from("therapists")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!card) throw new Error("Кабинет специалиста не найден");
    const { data: link } = await context.supabase
      .from("therapist_telegram")
      .select("chat_id")
      .eq("therapist_id", card.id)
      .maybeSingle();
    if (!link) throw new Error("Telegram ещё не подключён");
    const { sendTelegram } = await import("@/lib/telegram.server");
    const { buildTelegramMessage } = await import("@/lib/telegram");
    await sendTelegram(Number(link.chat_id), buildTelegramMessage("test", null)!);
    return { ok: true as const };
  });

/** Sends queued notifications right away (called after a request is created or changed). */
export const flushTelegramNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { flushTelegramOutbox } = await import("@/lib/telegram.server");
    const r = await flushTelegramOutbox(10);
    return { sent: r.sent };
  });
