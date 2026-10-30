import { createFileRoute } from "@tanstack/react-router";
import { fpSign, fpVerify } from "@/lib/freedompay";

const SCRIPT = "freedompay";

async function reply(status: "ok" | "rejected", description: string, secret: string) {
  const p: Record<string, string> = {
    pg_status: status,
    pg_description: description,
    pg_salt: crypto.randomUUID().replace(/-/g, ""),
  };
  p.pg_sig = await fpSign(SCRIPT, p, secret);
  const xml = `<?xml version="1.0" encoding="utf-8"?><response>${Object.entries(p)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join("")}</response>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}

export const Route = createFileRoute("/api/public/payments/freedompay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["FREEDOM_PAY_SECRET_KEY"];
        if (!secret) return new Response("not configured", { status: 503 });
        const form = new URLSearchParams(await request.text());
        const params: Record<string, string> = {};
        form.forEach((v, k) => (params[k] = v));
        if (!(await fpVerify(SCRIPT, params, secret))) return new Response("bad signature", { status: 401 });

        const orderId = params["pg_order_id"] ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(orderId)) return reply("rejected", "bad order", secret);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (params["pg_result"] !== "1") {
          await supabaseAdmin.rpc("fail_payment_order", { _order_id: orderId });
          return reply("ok", "failure noted", secret);
        }
        const amount = Math.round(Number(params["pg_amount"] ?? "0"));
        const { data, error } = await supabaseAdmin.rpc("fulfill_payment_order", {
          _order_id: orderId,
          _provider_payment_id: params["pg_payment_id"] ?? "",
          _amount: amount,
        });
        const ok = !error && (data as { ok?: boolean } | null)?.ok === true;
        return reply(ok ? "ok" : "rejected", ok ? "accepted" : "order mismatch", secret);
      },
    },
  },
});
