"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { apiGet, type PortfolioResponse } from "@/lib/client-api";
import { credits } from "@/lib/format";

export function AccountBar() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    function load() {
      apiGet<PortfolioResponse>("/api/portfolio")
        .then((d) => { if (active) { setPortfolio(d); setHasLoaded(true); } })
        .catch(() => { if (active) { setPortfolio(null); setHasLoaded(true); } });
    }
    load();
    window.addEventListener("fantasyx:data-changed", load);
    return () => { active = false; window.removeEventListener("fantasyx:data-changed", load); };
  }, []);

  const user = portfolio?.user;
  if (!hasLoaded || !user) return null;

  const pnlPositive = user.pnl >= 0;

  return (
    <div className="border-t border-rim/50 bg-panel/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden />
          <span className="text-xs font-bold text-frost truncate">{credits(user.mockBalance)}</span>
          <span className="hidden text-[10px] font-semibold text-muted sm:inline">mock credits</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 text-xs font-bold ${pnlPositive ? "text-neon" : "text-crimson"}`}>
            {pnlPositive
              ? <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              : <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            }
            <span>{pnlPositive ? "+" : ""}{credits(user.pnl)}</span>
          </div>
          <span className="hidden text-[10px] font-semibold text-muted sm:inline">P&L</span>
          {user.isAdmin && (
            <Link href={"/admin" as Route} className="rounded bg-amber/15 px-2 py-0.5 text-[10px] font-black text-amber">
              ADMIN
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
