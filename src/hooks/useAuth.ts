import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Client-side session state. `loading` is true until the first check finishes. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export type ProfileRow = {
  id: string;
  name: string;
  goal: string | null;
  life_status: string | null;
  coins: number;
  streak: number;
  last_entry_date: string | null;
  onboarded: boolean;
};

/** Current user's profile (browser client, RLS-scoped). `null` when signed out. */
export function useProfile() {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["profile", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, goal, life_status, coins, streak, last_entry_date, onboarded")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return { user, authLoading: loading, profile: query.data ?? null, ...query };
}

export function useSignOut() {
  const qc = useQueryClient();
  return async () => {
    await supabase.auth.signOut();
    qc.clear();
  };
}

/** True when the signed-in user has the admin role (moderation access). */
export function useIsAdmin() {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["is-admin", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return !!data;
    },
  });
  return { isAdmin: query.data === true, isLoading: loading || (!!user && query.isLoading) };
}
