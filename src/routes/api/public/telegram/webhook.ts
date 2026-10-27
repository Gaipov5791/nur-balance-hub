import { createFileRoute } from "@tanstack/react-router";

const HELP =
  "Это бот уведомлений Nur Balance для специалистов.\n\n" +
  "Чтобы получать сюда новые записи и напоминания, открой «Кабинет специалиста» в приложении и нажми «Подключить Telegram».\n\n" +
  "/stop — отключить уведомления.";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Update = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
    from?: { username?: string };
  };
};

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { webhookSecret, sendTelegram } = await import("@/lib/telegram.server");
        const expected = await webhookSecret();
        const actual = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        let update: Update;
        try {
          update = (await request.json()) as Update;
        } catch {
          return Response.json({ ok: true });
        }

        const msg = update.message;
        const chatId = msg?.chat?.id;
        const text = (msg?.text ?? "").trim().slice(0, 200);
        if (typeof chatId !== "number" || msg?.chat?.type !== "private") {
          return Response.json({ ok: true });
        }

        const reply = (t: string) => sendTelegram(chatId, { text: t }).catch((e) => console.error(e));

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const start = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{8,64}))?$/.exec(text);

          if (start?.[1]) {
            const { data: name, error } = await supabaseAdmin.rpc("consume_telegram_link_code", {
              _code: start[1],
              _chat_id: chatId,
              _username: (msg?.from?.username ?? "").slice(0, 64),
            });
            if (error) throw error;
            if (name === null || name === undefined) {
              await reply(
                "Ссылка устарела или уже использована. Открой «Кабинет специалиста» и нажми «Подключить Telegram» ещё раз.",
              );
            } else {
              await reply(
                `✅ Готово! Уведомления для специалиста ${name || ""} будут приходить сюда: новые записи, отмены и напоминания за 24 часа и за 1 час до консультации.`,
              );
            }
          } else if (/^\/stop(?:@\w+)?$/.test(text)) {
            const { error } = await supabaseAdmin
              .from("therapist_telegram")
              .delete()
              .eq("chat_id", chatId);
            if (error) throw error;
            await reply("Уведомления отключены. Подключить снова можно в «Кабинете специалиста».");
          } else {
            await reply(HELP);
          }
        } catch (e) {
          console.error("Telegram webhook error", e);
          await reply("Что-то пошло не так. Попробуй ещё раз чуть позже.");
        }

        return Response.json({ ok: true });
      },
    },
  },
});
