import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Video,
  BriefcaseMedical,
  CalendarDays,
  HeartHandshake,
  Trophy,
  LifeBuoy,
  Stethoscope,
  Settings,
  ShieldCheck,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useStaffAccess, useProfile } from "@/hooks/useAuth";
import { canAccessModeration } from "@/lib/staff";
import { useBuddyNotifications, useBuddyUnread } from "@/hooks/useBuddyNotifications";
import { NotificationsBell } from "@/components/NotificationsBell";

function UnreadBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`grid min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground ${className}`}
      aria-label={`Новых сообщений: ${count}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function ShellNavLink({
  item,
  pathname,
  unread,
  className = "py-2.5",
}: {
  item: NavItem;
  pathname: string;
  unread: number;
  className?: string;
}) {
  const active = pathname === item.to;
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${className} ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      }`}
    >
      <item.icon className="size-[18px] shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.to === "/buddy" ? <UnreadBadge count={unread} /> : null}
    </Link>
  );
}

type NavItem = { to: string; label: string; icon: LucideIcon; primaryMobile?: boolean };

const baseNav: NavItem[] = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/journal", label: "Дневник", icon: Video, primaryMobile: true },
  { to: "/archive", label: "Календарь", icon: CalendarDays },
  { to: "/buddy", label: "Поддержка", icon: HeartHandshake },
  { to: "/rewards", label: "Достижения", icon: Trophy },
  { to: "/care", label: "Советы", icon: LifeBuoy },
  { to: "/therapists", label: "Психологи", icon: Stethoscope },
  { to: "/settings", label: "Настройки", icon: Settings },
];

const moderationItem: NavItem = { to: "/moderation", label: "Модерация", icon: ShieldCheck };
const deskItem: NavItem = { to: "/therapist-desk", label: "Кабинет специалиста", icon: BriefcaseMedical };

const mobileNav = baseNav.filter((n) => ["/", "/journal", "/buddy", "/care"].includes(n.to));

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg">
        N
      </span>
      <span className="font-display text-lg tracking-tight">Nur Balance</span>
    </div>
  );
}

export function AppShell({
  children,
  aside,
  title,
}: {
  children: ReactNode;
  aside?: ReactNode;
  title?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile: real, user } = useProfile();
  const staffAccess = useStaffAccess();
  const isAdmin = canAccessModeration(staffAccess);
  useBuddyNotifications();
  const unread = useBuddyUnread();
  const myCard = useQuery({
    queryKey: ["my-therapist-card", user?.id ?? null],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("therapists")
        .select("id, name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const mainNav = baseNav;
  const staffNav: NavItem[] = [
    ...(myCard.data ? [deskItem] : []),
    ...(isAdmin ? [moderationItem] : []),
  ];
  const profile = {
    name: real?.name || user?.email?.split("@")[0] || "Вы",
    coins: real?.coins ?? 0,
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1500px] gap-6 px-4 pt-5 pb-28 lg:px-6 lg:pb-8">
        <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 flex-col rounded-3xl border border-border bg-sidebar p-4 lg:flex">
          <div className="px-2 pt-1 pb-5">
            <Logo />
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {mainNav.map((item) => (
              <ShellNavLink key={item.to} item={item} pathname={pathname} unread={unread} />
            ))}
            {staffNav.length > 0 ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Служебное
                </p>
                {staffNav.map((item) => (
                  <ShellNavLink key={item.to} item={item} pathname={pathname} unread={unread} />
                ))}
              </div>
            ) : null}
          </nav>
          <Link
            to="/settings"
            className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-shadow hover:shadow-soft"
          >
            <span className="grid size-10 place-items-center rounded-full bg-primary-soft font-display text-sm">
              {profile.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{profile.name}</span>
              <span className="block text-xs text-muted-foreground">
                {profile.coins} Nur-Coins
              </span>
            </span>
          </Link>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-5 flex items-center justify-between gap-3 lg:hidden">
            <Logo />
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-coin/30 px-3 py-1.5 text-sm font-semibold text-coin-foreground">
                🪙 {profile.coins}
              </span>
              <NotificationsBell />
            </div>
          </header>
          <div className="mb-5 hidden items-center justify-between gap-4 lg:flex">
            <h1 className="text-2xl">{title ?? ""}</h1>
            <NotificationsBell />
          </div>
          {children}
        </main>

        {aside ? (
          <aside className="sticky top-5 hidden h-fit w-[330px] shrink-0 flex-col gap-4 xl:flex">
            {aside}
          </aside>
        ) : null}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {mobileNav.map((item) => {
            const active = pathname === item.to;
            if (item.primaryMobile) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="grid size-14 -translate-y-4 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift"
                  aria-label={item.label}
                >
                  <item.icon className="size-6" />
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="size-5" />
                {item.to === "/buddy" ? (
                  <UnreadBadge count={unread} className="absolute top-0.5 right-2.5" />
                ) : null}
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`relative flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${
              menuOpen ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <span className="relative">
              <Menu className="size-5" />
              {isAdmin ? (
                <ShieldCheck className="absolute -right-2.5 -top-1 size-3 text-primary" aria-hidden />
              ) : null}
            </span>
            Меню
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[100svh] max-h-[100svh] w-full flex-col gap-0 overflow-hidden rounded-t-3xl border-border/40 bg-background p-0 pt-3 shadow-none lg:hidden"
        >
          <SheetHeader className="shrink-0 px-4">
            <SheetTitle className="font-display text-lg">Меню</SheetTitle>
          </SheetHeader>
          <Link
            to="/settings"
            className="mx-4 mt-2 flex shrink-0 items-center gap-3 rounded-2xl border border-border bg-card p-3"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-sm">
              {profile.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{profile.name}</span>
              <span className="block text-xs text-muted-foreground">
                {profile.coins} Nur-Coins
              </span>
            </span>
          </Link>
          {staffNav.length > 0 ? (
            <div className="mx-4 mt-3 shrink-0 rounded-2xl border border-primary/20 bg-primary-soft/60 p-2">
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Служебное
              </p>
              {staffNav.map((item) => (
                <ShellNavLink
                  key={item.to}
                  item={item}
                  pathname={pathname}
                  unread={unread}
                  className="py-3"
                />
              ))}
            </div>
          ) : null}
          <nav className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] touch-pan-y">
            {mainNav.map((item) => (
              <ShellNavLink
                key={item.to}
                item={item}
                pathname={pathname}
                unread={unread}
                className="py-3"
              />
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
