"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { apiPost } from "@/lib/client-api";
import { thresholdLabel } from "@/lib/format";
import type { Market, Player } from "@/lib/types";

export function ShareMarketButton({
  market,
  player,
  compact = false
}: {
  market: Market;
  player: Player;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const text = `FantasyX market: ${player.name} ${thresholdLabel(market.threshold)} at ${player.position}`;

  async function share() {
    const url = `${window.location.origin}/markets/${market.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }
      void apiPost("/api/beta-events", { type: "MARKET_SHARE", marketId: market.id, source: compact ? "market_card" : "market_detail" }).catch(() => undefined);
    } catch {
      // User-cancelled native share should not show an error.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-neon/25 bg-neon/10 font-black text-neon transition hover:bg-neon/20 ${
        compact ? "h-8 px-2 text-[10px]" : "h-10 px-3 text-xs"
      }`}
      aria-label={`Share ${player.name} ${thresholdLabel(market.threshold)} market`}
    >
      {copied ? <Copy className="h-3.5 w-3.5" aria-hidden /> : <Share2 className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
