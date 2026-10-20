import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseWallet, type AnalysisRow, type Wallet } from "@/lib/wallet";

/** Nur-Coins wallet. Reading it also applies any accrued +15 refills on the server. */
export function useWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["wallet", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<Wallet> => {
      const { data, error } = await supabase.rpc("coin_wallet");
      if (error) throw error;
      return parseWallet(data);
    },
  });
  const refilled = q.data?.refilled ?? 0;
  useEffect(() => {
    if (refilled > 0) {
      toast.success(`+${refilled} Nur-Coins на баланс`);
      void qc.invalidateQueries({ queryKey: ["profile"] });
    }
  }, [refilled, qc]);
  return q;
}

export function useAnalyses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ai-analyses", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<AnalysisRow[]> => {
      const { data, error } = await supabase
        .from("ai_analyses")
        .select("id, period, period_start, period_end, entries_count, paid_with, cost, status, result, created_at")
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as AnalysisRow[];
    },
  });
}
