"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Home, TrendingUp, Trophy, UserRound, Settings, ShieldCheck, LogOut, Activity, Radio } from "lucide-react";
import { apiGet, apiPost, type SessionResponse } from "@/lib/client-api";
import { BottomNav } from "@/components/bottom-nav";

const NAV_LINKS: Array<{ href: Route; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { href: "/" as Route,                label: "Home",        Icon: Home },
  { href: "/live" as Route,            label: "Live",        Icon: Radio },
  { href: "/markets" as Route,         label: "Markets",     Icon: TrendingUp },
  { href: "/markets/board" as Route,   label: "Board",       Icon: Activity },
  { href: "/portfolio" as Route,       label: "Portfolio",   Icon: BarChart2 },
  { href: "/leaderboard" as Route,     label: "Leaders",     Icon: Trophy },
  { href: "/account" as Route,         label: "Account",     Icon: UserRound }
];

const GUEST_NAV_LINKS = NAV_LINKS.filter(({ href }) => href !== "/portfolio" && href !== "/account");

export function SiteNav() {
  const [session, setSession] = useState<SessionResponse["user"] | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    function loadSession() {
      apiGet<SessionResponse>("/api/session")
        .then((data) => { if (active) { setSession(data.user); setHasLoaded(true); } })
        .catch(() => { if (active) { setSession(null); setHasLoaded(true); } });
    }
    loadSession();
    window.addEventListener("fantasyx:data-changed", loadSession);
    return () => { active = false; window.removeEventListener("fantasyx:data-changed", loadSession); };
  }, []);

  useEffect(() => {
    if (!hasLoaded || session || !requiresAuthentication(pathname)) return;
    window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hasLoaded, pathname, session]);

  async function logout() {
    await apiPost("/api/auth/logout", {});
    window.dispatchEvent(new Event("fantasyx:data-changed"));
    window.location.href = "/login";
  }

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary navigation">
        {hasLoaded && session ? (
          <>
            {NAV_LINKS.map(({ href, label, Icon }) => {
              const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                    isActive ? "bg-neon/10 text-neon" : "text-muted hover:bg-panel2 hover:text-frost"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
            {session.isAdmin && (
              <Link
                href={"/admin" as Route}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  pathname.startsWith("/admin") ? "bg-amber/10 text-amber" : "text-muted hover:bg-panel2 hover:text-frost"
                }`}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Admin
              </Link>
            )}
            <Link
              href={"/settings" as Route}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-panel2 hover:text-frost transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" aria-hidden />
            </Link>
            <button
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-panel2 hover:text-frost transition-colors"
              onClick={logout}
              type="button"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </>
        ) : hasLoaded ? (
          <>
            {GUEST_NAV_LINKS.map(({ href, label, Icon }) => {
              const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${isActive ? "bg-neon/10 text-neon" : "text-muted hover:bg-panel2 hover:text-frost"}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </Link>
              );
            })}
            <Link href={"/account" as Route} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-panel2 hover:text-frost">
              <UserRound className="h-4 w-4" aria-hidden /> Account
            </Link>
            <Link href={"/login" as Route} className="inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold text-muted hover:text-frost transition-colors">
              Log in
            </Link>
            <Link href={"/signup" as Route} className="inline-flex min-h-10 items-center rounded-lg bg-neon px-4 text-sm font-black text-surface hover:bg-neon/90 transition-colors">
              Sign up
            </Link>
          </>
        ) : null}
      </nav>

      {/* Mobile: auth links when logged out */}
      {hasLoaded && !session && (
        <div className="flex items-center gap-2 sm:hidden">
          <Link href={"/login" as Route} className="text-sm font-semibold text-muted">Log in</Link>
          <Link href={"/signup" as Route} className="rounded-lg bg-neon px-3 py-1.5 text-xs font-black text-surface">Sign up</Link>
        </div>
      )}

      {/* Mobile bottom nav */}
      <BottomNav isLoggedIn={hasLoaded && Boolean(session)} isReady={hasLoaded} />
    </>
  );
}

function requiresAuthentication(pathname: string) {
  return pathname === "/admin"
    || pathname.startsWith("/admin/");
}
