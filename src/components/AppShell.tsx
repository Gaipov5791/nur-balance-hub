import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Video,
  CalendarDays,
  HeartHandshake,
  Trophy,
  LifeBuoy,
  Stethoscope,
  Settings,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { profile } from "@/data/demo";

type NavItem = { to: string; label: string; icon: LucideIcon; primaryMobile?: boolean };

const nav: NavItem[] = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/journal", label: "Дневник", icon: Video, primaryMobile: true },
  { to: "/archive", label: "Календарь", icon: CalendarDays },
  { to: "/buddy", label: "Поддержка", icon: HeartHandshake },
  { to: "/rewards", label: "Достижения", icon: Trophy },
  { to: "/care", label: "Советы", icon: LifeBuoy },
  { to: "/therapists", label: "Психологи", icon: Stethoscope },
  { to: "/settings", label: "Настройки", icon: Settings },
];

const mobileNav = nav.filter((n) => ["/", "/journal", "/buddy", "/care"].includes(n.to));

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
            {nav.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="size-[18px]" />
                  {item.label}
                </Link>
              );
            })}
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
          <header className="mb-5 flex items-center justify-between gap-4 lg:hidden">
            <Logo />
            <span className="rounded-full bg-coin/30 px-3 py-1.5 text-sm font-semibold text-coin-foreground">
              🪙 {profile.coins}
            </span>
          </header>
          {title ? (
            <h1 className="mb-5 hidden text-2xl lg:block">{title}</h1>
          ) : null}
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
                className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${
              menuOpen ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Menu className="size-5" />
            Меню
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 pb-8 lg:hidden"
        >
          <SheetHeader className="px-0 pt-2">
            <SheetTitle className="font-display text-lg">Меню</SheetTitle>
          </SheetHeader>
          <Link
            to="/settings"
            className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
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
          <nav className="mt-4 grid gap-1">
            {nav.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="size-[18px] shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
