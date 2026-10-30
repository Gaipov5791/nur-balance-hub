import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fpSign, xmlValue } from "./freedompay";

const PRICES = { subscription: 2150, coin_pack: 1890 } as const;
const TITLES = { subscription: "Подписка Nur Balance, 30 дней", coin_pack: "230 Nur-Coins" } as const;

/** Creates an order and returns the Freedom Pay payment page URL. */
export const startPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["subscription", "coin_pack"]), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const merchant = process.env["FREEDOM_PAY_MERCHANT_ID"];
    const secret = process.env["FREEDOM_PAY_SECRET_KEY"];
    if (!merchant || !secret) throw new Error("Оплата временно недоступна");
    const testing = (process.env["FREEDOM_PAY_TESTING"] ?? "1") !== "0";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const amount = PRICES[data.kind];
    const { data: order, error } = await supabaseAdmin
      .from("payment_orders")
      .insert({ user_id: context.userId, kind: data.kind, amount_kzt: amount })
      .select("id")
      .single();
    if (error || !order) throw new Error("Не получилось создать заказ");

    const back = new URL("/rewards", data.origin).toString();
    const params: Record<string, string> = {
      pg_merchant_id: merchant,
      pg_order_id: order.id,
      pg_amount: String(amount),
      pg_currency: "KZT",
      pg_description: TITLES[data.kind],
      pg_salt: crypto.randomUUID().replace(/-/g, ""),
      pg_result_url: "https://nur-balance-hub.lovable.app/api/public/payments/freedompay",
      pg_request_method: "POST",
      pg_success_url: `${back}?paid=${order.id}`,
      pg_failure_url: `${back}?payfail=1`,
      pg_user_id: context.userId,
      pg_testing_mode: testing ? "1" : "0",
      pg_language: "ru",
    };
    params["pg_sig"] = await fpSign("init_payment.php", params, secret);
    const res = await fetch("https://api.freedompay.kz/init_payment.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    const xml = await res.text();
    const url = xmlValue(xml, "pg_redirect_url");
    if (xmlValue(xml, "pg_status") !== "ok" || !url) {
      console.error("freedompay init failed", xmlValue(xml, "pg_error_code"), xmlValue(xml, "pg_error_description"));
      await supabaseAdmin.rpc("fail_payment_order", { _order_id: order.id });
      throw new Error("Платёжная система не ответила. Попробуй ещё раз.");
    }
    return { url, orderId: order.id };
  });
