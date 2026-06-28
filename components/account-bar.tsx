"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { apiGet, type PortfolioResponse } from "@/lib/client-api";
import { credits } from "@/lib/format";

export function AccountBar() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    function loadAccount() {
      apiGet<PortfolioResponse>("/api/portfolio")
      .then((data) => {
        if (active) {
          setPortfolio(data);
          setHasLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setPortfolio(null);
          setHasLoaded(true);
        }
      });
    }

    loadAccount();
    window.addEventListener("fantasyx:data-changed", loadAccount);
    return () => {
      active = false;
      window.removeEventListener("fantasyx:data-changed", loadAccount);
    };
  }, []);

  const user = portfolio?.user;

  return (
    <div className="border-t border-ink/5 bg-white/65">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs sm:text-sm">
        <div className="flex min-w-0 items-center gap-2 font-semibold">
          <UserRound className="h-4 w-4 text-field" aria-hidden />
          <span className="truncate">{user?.name ?? "FantasyX"}</span>
        </div>
        <div className="flex items-center gap-3 text-right">
          <span className="hidden text-ink/70 sm:inline">Mock credits only</span>
          <span className="font-bold">{user ? credits(user.mockBalance) : hasLoaded ? "Not signed in" : "Loading"}</span>
          {user ? (
            <>
              <span className={user.pnl >= 0 ? "font-bold text-field" : "font-bold text-rush"}>{user.pnl >= 0 ? "+" : ""}{credits(user.pnl)}</span>
              <span className="hidden font-bold sm:inline">Equity {credits(user.equity)}</span>
              {user.isAdmin ? <span className="rounded bg-gold/20 px-2 py-1 text-xs font-black text-ink">Admin</span> : null}
            </>
          ) : (
            <Link className="rounded bg-ink px-3 py-1.5 text-xs font-black text-white hover:bg-field" href={"/login" as Route}>Login</Link>
          )}
        </div>
      </div>
    </div>
  );
}
