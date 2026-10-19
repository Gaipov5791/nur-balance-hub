import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { parseAnalysisResult, type AnalysisDto, type AnalysisPeriod } from "@/lib/analysis";
import { coinsWord } from "@/lib/economy";

export const coinKeys = {
  all: ["coins"] as const,
  wallet: (userId: string | null) => ["coins", "wallet", userId] as const,
  refill: (userId: string | null) => ["coins", "refill", userId] as const,
  history: (userId: string | null) => ["coins", "history", userId] as const,
  analyses: (userId: string | null) => ["coins", "analyses", userId] as const,
};

export type CoinWallet = {
  coins: number;
  nextRefillAt: string;
  refillAmount: number;
  analysisCost: number;
  subscribed: boolean;
  subscriptionEndsAt: string | null;
  freeAnalysisAvailable: boolean;
};

function field(o: Json, key: string) {
  return o && typeof o === "object" && !Array.isArray(o) ? o[key] : undefined;
}

function asWallet(data: Json): CoinWallet {
  const ends = field(data, "subscriptionEndsAt");
  return {
    coins: Number(field(data, "coins") ?? 0),
    nextRefillAt: String(field(data, "nextRefillAt") ?? new Date().toISOString()),
    refillAmount: Number(field(data, "refillAmount") ?? 15),
    analysisCost: Number(field(data, "analysisCost") ?? 15),
    subscribed: field(data, "subscribed") === true,
    subscriptionEndsAt: typeof ends === "string" ? ends : null,
    freeAnalysisAvailable: field(data, "freeAnalysisAvailable") === true,
  };
}

export function useCoinWallet() {
  const { user } = useAuth();
  return useQuery({
    queryKey: coinKeys.wallet(user?.id ?? null),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("coin_wallet");
      if (error) throw new Error("Не удалось загрузить баланс");
      return asWallet(data);
    },
  });
}

/** Claims the 3-day refill when the app opens or regains focus. Safe to call often: the server pays once per period. */
export function useCoinRefill() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useQuery({
    queryKey: coinKeys.refill(user?.id ?? null),
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("claim_coin_refill");
      if (error) throw error;
      const granted = Number(field(data, "granted") ?? 0);
      if (granted > 0) {
        toast.success(`+${granted} ${coinsWord(granted)} — пополнение Нур-Коинов`);
        void qc.invalidateQueries({ queryKey: ["profile"] });
        void qc.invalidateQueries({
          queryKey: coinKeys.all,
          predicate: (x) => x.queryKey[1] !== "refill",
        });
      }
      return granted;
    },
  });
}

export type CoinTransaction = { id: string; action: string; amount: number; created_at: string };

export function useCoinHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: coinKeys.history(user?.id ?? null),
    enabled: !!user,
    queryFn: async (): Promise<CoinTransaction[]> => {
      const { data, error } = await supabase
        .from("coin_transactions")
        .select("id, action, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error("Не удалось загрузить историю");
      return data ?? [];
    },
  });
}

export function useAnalyses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: coinKeys.analyses(user?.id ?? null),
    enabled: !!user,
    queryFn: async (): Promise<AnalysisDto[]> => {
      const { data, error } = await supabase
        .from("ai_analyses")
        .select("id, period, period_from, period_to, cost, created_at, result")
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error("Не удалось загрузить историю анализов");
      return (data ?? []).flatMap((row) => {
        const result = parseAnalysisResult(row.result);
        if (!result) return [];
        return [
          {
            id: row.id,
            period: (row.period === "month" ? "month" : "week") as AnalysisPeriod,
            from: row.period_from,
            to: row.period_to,
            cost: row.cost,
            createdAt: row.created_at,
            result,
          },
        ];
      });
    },
  });
}

export function useDeleteAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("delete_ai_analysis", { _id: id });
      if (error || data !== true) throw new Error("Не удалось удалить анализ");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: coinKeys.all }),
  });
}
