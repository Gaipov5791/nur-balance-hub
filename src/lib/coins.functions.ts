import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const actionInput = z.object({
  action: z.enum(["practice", "buddy", "profile_complete"]),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type AwardResult = {
  granted: number;
  coins: number;
  reason: "granted" | "already" | "limit";
  label: string;
};

export type RedeemResult = {
  ok: boolean;
  coins: number;
  reason: "redeemed" | "already" | "insufficient";
};

function asObject(data: Json | null) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Некорректный ответ сервера");
  }
  return data as Record<string, Json | undefined>;
}

function asAward(data: Json | null): AwardResult {
  const o = asObject(data);
  const reason = o["reason"];
  if (reason !== "granted" && reason !== "already" && reason !== "limit") {
    throw new Error("Не удалось начислить монеты. Попробуйте ещё раз");
  }
  const label = o["label"];
  return {
    granted: Number(o["granted"] ?? 0),
    coins: Number(o["coins"] ?? 0),
    reason,
    label: typeof label === "string" ? label : "",
  };
}

function asRedeem(data: Json | null): RedeemResult {
  const o = asObject(data);
  const reason = o["reason"];
  if (reason !== "redeemed" && reason !== "already" && reason !== "insufficient") {
    throw new Error("Не удалось активировать награду. Попробуйте ещё раз");
  }
  return {
    ok: o["ok"] === true,
    coins: Number(o["coins"] ?? 0),
    reason,
  };
}

/** Grants Nur-Coins for an action. Amounts and limits live in Postgres. */
export const awardCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => actionInput.parse(input))
  .handler(async ({ data, context }): Promise<AwardResult> => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("award_action", { _action: data.action });
    if (error) throw new Error("Не удалось начислить монеты. Попробуйте ещё раз");
    return asAward(result);
  });

/** Redeems a catalog reward. Cost is read from the server catalog. */
export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ rewardId: z.string().max(50) }).parse(input))
  .handler(async ({ data, context }): Promise<RedeemResult> => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("redeem_catalog_reward", {
      _reward_id: data.rewardId,
    });
    if (error) throw new Error("Не удалось активировать награду. Попробуйте ещё раз");
    return asRedeem(result);
  });

export const listRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("reward_redemptions")
      .select("reward_id")
      .eq("user_id", userId);
    return (data ?? []).map((r) => r.reward_id);
  });
