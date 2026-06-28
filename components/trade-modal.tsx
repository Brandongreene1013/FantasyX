"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { getSidePrice, quoteBuy } from "@/lib/amm";
import { apiPost, type PortfolioResponse } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { Market, Player, Side } from "@/lib/types";

export function TradeModal({
  market,
  player,
  side,
  balance,
  onTradeComplete,
  onClose
}: {
  market: Market;
  player: Player;
  side: Side;
  balance: number;
  onTradeComplete: () => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const amountId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const liveRegionId = useId();
  const priceBefore = getSidePrice(market, side);
  const quote = useMemo(() => quoteBuy(market, side, amount), [amount, market, side]);
  const averagePrice = quote.shares > 0 ? amount / quote.shares : 0;
  const slippage = averagePrice > 0 ? Math.max(0, (averagePrice - priceBefore) / priceBefore) : 0;
  const canTrade = amount > 0 && amount <= balance && market.status === "OPEN" && !isSubmitting;
  const amountError = amount > balance ? "Amount exceeds mock credit balance." : amount <= 0 ? "Amount must be greater than zero." : null;

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    amountInputRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  async function confirmTrade() {
    if (!canTrade) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setStatusMessage("Submitting trade.");
    try {
      await apiPost<PortfolioResponse>("/api/trades", {
        marketId: market.id,
        side,
        spend: amount
      });
      window.dispatchEvent(new Event("fantasyx:data-changed"));
      setStatusMessage("Trade confirmed.");
      onTradeComplete();
      onClose();
    } catch (tradeError) {
      setError(tradeError instanceof Error ? tradeError.message : "Trade failed");
      setStatusMessage("Trade failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-ink/45 p-0 sm:place-items-center sm:p-4">
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-t border border-ink/10 bg-white p-4 shadow-soft sm:rounded"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-field">Trade ticket</p>
            <h2 id={titleId} className="mt-1 text-2xl font-black">Buy {side}</h2>
            <p id={descriptionId} className="text-sm font-semibold text-ink/70">
              {player.name} {thresholdLabel(market.threshold)} at {player.position}
            </p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded border border-ink/10 hover:bg-ink/5" onClick={onClose} type="button" aria-label="Close trade ticket">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-5">
          <label htmlFor={amountId} className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">Amount</label>
          <input
            ref={amountInputRef}
            id={amountId}
            className="h-12 w-full rounded border border-ink/15 bg-chalk px-3 text-lg font-black outline-none focus:border-field"
            min={1}
            max={balance}
            onChange={(event) => setAmount(Number(event.target.value))}
            aria-describedby={`${amountHelpId}${amountError ? ` ${amountErrorId}` : ""}`}
            aria-invalid={Boolean(amountError)}
            type="number"
            value={amount}
          />
          <p id={amountHelpId} className="mt-1 text-xs font-semibold text-ink/70">Enter the mock credits to spend. Available balance: {credits(balance)}.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Side" value={side} />
          <Metric label="Market price" value={pct(priceBefore)} />
          <Metric label="Estimated shares" value={quote.shares.toFixed(2)} />
          <Metric label="Average price" value={pct(averagePrice)} />
          <Metric label="Slippage" value={pct(slippage)} />
          <Metric label="Balance after" value={credits(balance - amount)} />
        </div>

        {amountError ? (
          <p id={amountErrorId} className="mt-3 rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush" role="alert">{amountError}</p>
        ) : null}
        {error ? <p className="mt-3 rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush" role="alert">{error}</p> : null}
        <p id={liveRegionId} className="sr-only" aria-live="polite" aria-atomic="true">{statusMessage}</p>

        <button
          className="mt-5 h-12 w-full rounded bg-ink text-sm font-black text-white transition hover:bg-field disabled:cursor-not-allowed disabled:bg-ink/30"
          disabled={!canTrade}
          onClick={confirmTrade}
          aria-describedby={liveRegionId}
          type="button"
        >
          {isSubmitting ? "Confirming..." : "Confirm trade"}
        </button>
      </div>
    </div>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3">
      <p className="text-xs font-black uppercase tracking-widest text-ink/70">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
