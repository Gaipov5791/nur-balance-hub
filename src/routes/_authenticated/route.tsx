import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/AppShell";

function LoadingSplash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <Logo />
        <p className="text-sm text-muted-foreground">Загружаем твоё пространство…</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 0,
  pendingComponent: LoadingSplash,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
