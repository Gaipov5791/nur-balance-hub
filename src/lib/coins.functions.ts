import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rewards } from "@/data/demo";

const DAILY_LIMIT = 30;
const LIMITED_PREFIXES = ["journal_daily", "mood", "practice", "buddy"];

const ACTIONS = {
  practice: { amount: 5, daily: true, label: "Практика выполнена" },
  buddy: { amount: 5, daily: true, label: "Разговор с бадди" },
  profile_complete: { amount: 15, daily: false, label: "Профиль заполнен" },
} as const;

type ActionKey = keyof typeof ACTIONS;

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

/** Grants Nur-Coins for an action. Amounts are fixed server-side — the client never sends them. */
export const awardCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => actionInput.parse(input))
  .handler(async ({ data, context }): Promise<AwardResult> => {
    const { supabase, userId } = context;
    const key = data.action as ActionKey;
    const rule = ACTIONS[key];
    const day = new Date().toISOString().slice(0, 10);
    const actionId = rule.daily ? `${key}:${day}` : key;

    const [{ data: profile }, { data: txs }] = await Promise.all([
      supabase.from("profiles").select("coins").eq("id", userId).single(),
      supabase.from("coin_transactions").select("action, amount").eq("user_id", userId),
    ]);
    const coins = profile?.coins ?? 0;
    const all = txs ?? [];

    if (all.some((t) => t.action === actionId)) {
      return { granted: 0, coins, reason: "already", label: rule.label };
    }

    let amount: number = rule.amount;
    if (rule.daily) {
      const earnedToday = all
        .filter((t) => LIMITED_PREFIXES.some((p) => t.action === `${p}:${day}`))
        .reduce((s, t) => s + t.amount, 0);
      amount = Math.min(amount, Math.max(0, DAILY_LIMIT - earnedToday));
      if (amount === 0) return { granted: 0, coins, reason: "limit", label: rule.label };
    }

    const { error } = await supabase
      .from("coin_transactions")
      .insert({ user_id: userId, action: actionId, amount });
    if (error) throw new Error("Не удалось начислить монеты. Попробуйте ещё раз");

    const next = coins + amount;
    await supabase.from("profiles").update({ coins: next }).eq("id", userId);
    return { granted: amount, coins: next, reason: "granted", label: rule.label };
  });

export type RedeemResult = {
  ok: boolean;
  coins: number;
  reason: "redeemed" | "already" | "insufficient";
};

/** Redeems a catalog reward: cost is read from the server catalog and deducted atomically enough for MVP. */
export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ rewardId: z.string().max(50) }).parse(input))
  .handler(async ({ data, context }): Promise<RedeemResult> => {
    const { supabase, userId } = context;
    const reward = rewards.find((r) => r.id === data.rewardId);
    if (!reward) throw new Error("Награда не найдена");

    const { data: profile } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();
    const coins = profile?.coins ?? 0;

    const { data: existing } = await supabase
      .from("reward_redemptions")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_id", reward.id)
      .maybeSingle();
    if (existing) return { ok: false, coins, reason: "already" };

    if (coins < reward.cost) return { ok: false, coins, reason: "insufficient" };

    const { error } = await supabase.from("reward_redemptions").insert({
      user_id: userId,
      reward_id: reward.id,
      title: reward.title,
      cost: reward.cost,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, coins, reason: "already" };
      throw new Error("Не удалось активировать награду. Попробуйте ещё раз");
    }

    const next = coins - reward.cost;
    if (reward.cost > 0) {
      await supabase.from("profiles").update({ coins: next }).eq("id", userId);
    }
    return { ok: true, coins: next, reason: "redeemed" };
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
