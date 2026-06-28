import { credits, pct, thresholdLabel } from "@/lib/format";
import type { MarketEventsResponse } from "@/lib/client-api";

type Event = MarketEventsResponse["events"][number];

export function MarketTimeline({ events, compact = false }: { events: Event[]; compact?: boolean }) {
  if (events.length === 0) {
    return (
      <div className="rounded border border-ink/10 bg-white p-5 text-sm font-bold text-ink/70 shadow-soft">
        No market events yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-ink/10 bg-white shadow-soft">
      <div className="border-b border-ink/10 bg-chalk px-4 py-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-ink/70">Market Timeline</h2>
      </div>
      <div className="divide-y divide-ink/10">
        {events.map((event) => (
          <article className="grid gap-2 p-4 sm:grid-cols-[9rem_1fr_auto] sm:items-start" key={event.id}>
            <time className="text-xs font-bold text-ink/60" dateTime={event.createdAt}>
              {new Date(event.createdAt).toLocaleString()}
            </time>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-field/10 px-2 py-1 text-xs font-black text-field">{event.type.replace("_", " ")}</span>
                <span className="text-sm font-black">{event.playerName}</span>
                <span className="text-xs font-bold text-ink/60">{event.position} {thresholdLabel(event.thresholdType)}</span>
              </div>
              {event.note ? <p className="mt-1 text-sm font-semibold text-ink/70">{event.note}</p> : null}
              {!compact ? (
                <p className="mt-2 text-xs font-semibold text-ink/60">
                  Liquidity {event.liquidity === null ? "n/a" : credits(event.liquidity)} · Volume {event.volume === null ? "n/a" : credits(event.volume)} · Open interest {event.openInterest?.toFixed(2) ?? "n/a"}
                </p>
              ) : null}
            </div>
            <div className="text-sm font-black sm:text-right">
              {event.priceBefore !== null && event.priceAfter !== null ? (
                <span>{pct(event.priceBefore)} → {pct(event.priceAfter)}</span>
              ) : event.priceAfter !== null ? (
                <span>{pct(event.priceAfter)}</span>
              ) : (
                <span className="text-ink/50">No price</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
