"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, BarChart2, Trophy, Radio } from "lucide-react";
import type { Route } from "next";

const TABS = [
  { href: "/markets" as Route,     label: "Markets",     Icon: TrendingUp },
  { href: "/live" as Route,        label: "Live",        Icon: Radio },
  { href: "/portfolio" as Route,   label: "Portfolio",   Icon: BarChart2 },
  { href: "/leaderboard" as Route, label: "Leaderboard", Icon: Trophy }
];

export function BottomNav({ isLoggedIn, isReady = true }: { isLoggedIn: boolean; isReady?: boolean }) {
  const pathname = usePathname();

  if (!isReady) return null;

  const tabs = isLoggedIn ? TABS : TABS.map((tab) => tab.href === "/portfolio" ? { ...tab, href: "/login?next=%2Fportfolio" as Route } : tab);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rim bg-panel/95 backdrop-blur-xl sm:hidden"
      aria-label="Mobile navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid grid-cols-4">
        {tabs.map(({ href, label, Icon }) => {
          const isActive = label === "Portfolio" ? pathname === "/portfolio" : pathname.startsWith(href.split("?")[0]);
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
