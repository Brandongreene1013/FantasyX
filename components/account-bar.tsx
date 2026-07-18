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
    <div className="flex shrink-0 items-center gap-3 border-l border-rim/60 pl-4" aria-label="Account summary">
      <div className="flex min-w-0 items-center gap-1.5">
        <Wallet className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        <span className="truncate text-xs font-black text-frost">{credits(user.mockBalance)}</span>
        <span className="hidden text-[10px] font-semibold text-muted md:inline">balance</span>
      </div>
      <div className={`flex items-center gap-1 text-xs font-black ${pnlPositive ? "text-neon" : "text-crimson"}`}>
        {pnlPositive
          ? <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          : <TrendingDown className="h-3.5 w-3.5" aria-hidden />
        }
        <span>{pnlPositive ? "+" : ""}{credits(user.pnl)}</span>
        <span className="hidden text-[10px] font-semibold text-muted md:inline">P&amp;L</span>
      </div>
      {user.isAdmin && (
        <Link href={"/admin" as Route} className="rounded bg-amber/15 px-2 py-0.5 text-[10px] font-black text-amber">
          ADMIN
        </Link>
      )}
    </div>
  );
}
