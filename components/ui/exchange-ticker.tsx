"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { apiGet, defaultWeekId, type SlateResponse } from "@/lib/client-api";
import { pct, thresholdLabel } from "@/lib/format";

type TickerItem = {
  id: string;
  name: string;
  team: string;
  position: string;
  threshold: string;
  yesPrice: number;
  move: number;
};

export function ExchangeTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    apiGet<SlateResponse>(`/api/slate?weekId=${defaultWeekId}`)
      .then((slate) => {
        const pm = new Map(slate.players.map((p) => [p.id, p]));
        const tickers = slate.markets
          .filter((m) => m.status === "OPEN")
          .map((m) => {
            const p = pm.get(m.playerId);
            if (!p) return null;
            const move = ((m.yesPrice - m.openingPrice) / Math.max(m.openingPrice, 0.01)) * 100;
            return { id: m.id, name: p.name, team: p.team, position: p.position, threshold: thresholdLabel(m.threshold), yesPrice: m.yesPrice, move };
          })
          .filter(Boolean) as TickerItem[];
        setItems(tickers);
      })
      .catch(() => undefined);
  }, []);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div
      className="overflow-hidden border-b border-rim/50 bg-surface"
      role="region"
      aria-label="Live market price ticker"
    >
      <div className="animate-ticker flex py-1.5" style={{ width: "max-content" }}>
        {doubled.map((item, i) => (
          <span
            key={`${item.id}-${i}`}
            className="inline-flex shrink-0 items-center gap-1.5 px-4"
          >
            <span className="text-[11px] font-black text-frost">{item.name}</span>
            <span className="text-[9px] font-bold text-muted">{item.threshold}</span>
            <span className={`text-[11px] font-black ${item.yesPrice >= 0.5 ? "text-neon" : "text-crimson"}`}>
              {pct(item.yesPrice)}
            </span>
            {item.move !== 0 && (
              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${item.move > 0 ? "text-neon/80" : "text-crimson/80"}`}>
                {item.move > 0
                  ? <TrendingUp className="h-2.5 w-2.5" aria-hidden />
                  : <TrendingDown className="h-2.5 w-2.5" aria-hidden />
                }
                {item.move > 0 ? "+" : ""}{item.move.toFixed(1)}%
              </span>
            )}
            <span className="mx-2 text-rim text-xs" aria-hidden>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
