import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/public/nur-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!url || !key) return json(500, { error: "Сервер не настроен" });
        if (!token) return json(401, { error: "Войдите, чтобы говорить с НурAI" });

        const supabase = createClient<Database>(url, key, {
          global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return json(401, { error: "Сессия истекла, войдите снова" });
        const userId = userData.user.id;

        let text = "";
        try {
          const body = (await request.json()) as { text?: unknown };
          text = typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
        } catch {
          /* empty */
        }
        if (!text) return json(400, { error: "Пустое сообщение" });

        const { data: usage, error: usageErr } = await supabase.rpc("consume_ai_message");
        if (usageErr) return json(500, { error: "Не удалось проверить лимит" });
        const u = usage as { allowed: boolean; used: number; limit: number };
        if (!u.allowed) {
          return json(429, {
            error: "На сегодня лимит сообщений НурAI исчерпан. Завтра можно продолжить, а пока можно поискать собеседника в Круге поддержки.",
            limit: true,
          });
        }

        const { data: history } = await supabase
          .from("ai_chat_messages")
          .select("role, content")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30);
        const { error: insErr } = await supabase
          .from("ai_chat_messages")
          .insert({ user_id: userId, role: "user", content: text });
        if (insErr) return json(500, { error: "Не удалось сохранить сообщение" });

        const messages = [
          ...(history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user" as const, content: text },
        ];

        const { createNurAiStream } = await import("@/lib/nur-ai.server");
        const result = createNurAiStream(request, messages, async (answer) => {
          if (!answer.trim()) return;
          const { error } = await supabase
            .from("ai_chat_messages")
            .insert({ user_id: userId, role: "assistant", content: answer });
          if (error) console.error("nur-ai save failed", error.message);
        });
        const res = result.toTextStreamResponse();
        res.headers.set("x-ai-used", String(u.used));
        res.headers.set("x-ai-limit", String(u.limit));
        return res;
      },
    },
  },
});
