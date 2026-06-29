"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedEvent } from "@/lib/live-types";
import { TapeRow } from "@/components/ui/terminal-panel";

export function ExchangeFeed({
  events,
  maxItems = 12,
  className = ""
}: {
  events: FeedEvent[];
  maxItems?: number;
  className?: string;
}) {
  const seenRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const incoming = events.filter((e) => !seenRef.current.has(e.id));
    if (incoming.length === 0) return;
    const ids = new Set(incoming.map((e) => e.id));
    for (const id of ids) seenRef.current.add(id);
    setNewIds((prev) => new Set([...prev, ...ids]));
    const t = setTimeout(() => setNewIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    }), 700);
    return () => clearTimeout(t);
  }, [events]);

  const visible = events.slice(0, maxItems);

  if (visible.length === 0) {
    return (
      <div className={`rounded-lg border border-rim bg-panel px-4 py-6 text-center font-mono text-[10px] text-muted ${className}`}>
        WAITING FOR TRADES…
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-rim bg-panel overflow-hidden ${className}`}>
      {/* Tape header */}
      <div className="grid grid-cols-[4rem_2rem_1.5rem_1fr_3rem] gap-2 border-b border-rim/60 bg-panel2 px-3 py-1.5">
        {["TIME","ACT","SIDE","PLAYER · MKTID","PRICE"].map((h) => (
          <span key={h} className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted/60">{h}</span>
        ))}
      </div>
      <div>
        {visible.map((ev) => (
          <TapeRow
            key={ev.id}
            marketId={ev.marketId}
            actorName={ev.actorName}
            action={ev.action}
            side={ev.side}
            playerName={ev.playerName}
            threshold={ev.threshold}
            position={ev.position}
            priceAfter={ev.priceAfter}
            createdAt={ev.createdAt}
            isNew={newIds.has(ev.id)}
          />
        ))}
      </div>
    </div>
  );
}
