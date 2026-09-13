import { journalReminderHtml, journalReminderSubject } from "../_shared/transactional-email-templates/journal-reminder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  to?: string;
  template?: string;
  subject?: string;
  html?: string;
  text?: string;
  data?: {
    name?: string;
    journalUrl?: string;
    settingsUrl?: string;
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    if (!payload.to) {
      return Response.json({ error: "Missing recipient" }, { status: 400, headers: corsHeaders });
    }

    const journalUrl = payload.data?.journalUrl ?? "https://nur-balance-hub.lovable.app/journal";
    const settingsUrl = payload.data?.settingsUrl ?? "https://nur-balance-hub.lovable.app/settings";
    const subject = payload.subject ?? journalReminderSubject;
    const html =
      payload.html ??
      journalReminderHtml({
        name: payload.data?.name,
        journalUrl,
        settingsUrl,
      });
    const text =
      payload.text ??
      `${subject}\n\n${journalUrl}\n\nОтключить: ${settingsUrl}`;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return Response.json(
        { error: "RESEND_API_KEY is not configured", skipped: true },
        { status: 501, headers: corsHeaders },
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("REMINDER_FROM_EMAIL") ?? "Nur Balance <noreply@nur-balance-hub.lovable.app>",
        to: [payload.to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return Response.json({ error: detail }, { status: 502, headers: corsHeaders });
    }

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Send failed" },
      { status: 500, headers: corsHeaders },
    );
  }
});
