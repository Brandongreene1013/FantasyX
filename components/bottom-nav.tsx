"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TrendingUp, BarChart2, Trophy, Radio } from "lucide-react";
import type { Route } from "next";

const TABS = [
  { href: "/" as Route,            label: "Home",        Icon: Home },
  { href: "/live" as Route,        label: "Live",        Icon: Radio },
  { href: "/markets" as Route,     label: "Markets",     Icon: TrendingUp },
  { href: "/portfolio" as Route,   label: "Portfolio",   Icon: BarChart2 },
  { href: "/leaderboard" as Route, label: "Leaders",     Icon: Trophy }
];

export function BottomNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();

  if (!isLoggedIn) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rim bg-panel/95 backdrop-blur-xl sm:hidden"
      aria-label="Mobile navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 py-2 min-h-[56px] justify-center transition-colors ${
                isActive ? "text-neon" : "text-muted hover:text-frost"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon className="h-5 w-5" aria-hidden />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-neon" aria-hidden />
                )}
              </div>
              <span className={`text-[10px] font-bold leading-none ${isActive ? "text-neon" : ""}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
