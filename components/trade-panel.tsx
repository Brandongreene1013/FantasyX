"use client";

import { useId, useMemo, useRef, useState } from "react";
import { getSidePrice, quoteBuy } from "@/lib/amm";
import { apiPost } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { Market, Player, Side } from "@/lib/types";

export function TradePanel({
  market,
  player,
  balance,
  onTradeComplete
}: {
  market: Market;
  player: Player;
  balance: number;
  onTradeComplete: () => void;
}) {
  const [side, setSide] = useState<Side>("YES");
  const [amount, setAmount] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const amountId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const liveId = useId();

  const isOpen = market.status === "OPEN";
  const priceBefore = getSidePrice(market, side);
  const quote = useMemo(() => quoteBuy(market, side, amount), [market, side, amount]);
  const estimatedShares = quote.shares;
  const avgEntry = estimatedShares > 0 ? amount / estimatedShares : 0;
  const balanceAfter = balance - amount;

  const amountError =
    amount <= 0
      ? "Amount must be greater than zero."
      : amount > balance
        ? "Amount exceeds available balance."
        : null;

  const canTrade = isOpen && amount > 0 && amount <= balance && !isSubmitting;

  async function submit() {
    if (!canTrade) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await apiPost("/api/trades", { marketId: market.id, side, spend: amount });
      setSuccess(true);
      onTradeComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-label="Trade panel" className="rounded border border-ink/10 bg-white p-5 shadow-soft">
      <h2 className="text-sm font-black uppercase tracking-widest text-ink/70">Trade</h2>
      <p className="mt-1 text-xs font-semibold text-ink/60">
        {player.name} · {thresholdLabel(market.threshold)} · {player.position}
      </p>

      {!isOpen ? (
        <div className="mt-4 rounded bg-ink/5 p-4 text-sm font-bold text-ink/70">
          Market is {market.status.toLowerCase()} — trading is disabled.
          {market.result ? ` Result: ${market.result}.` : ""}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <SideButton active={side === "YES"} label="YES" price={getSidePrice(market, "YES")} disabled={!isOpen} onClick={() => { setSide("YES"); setError(null); setSuccess(false); }} />
        <SideButton active={side === "NO"} label="NO" price={getSidePrice(market, "NO")} disabled={!isOpen} onClick={() => { setSide("NO"); setError(null); setSuccess(false); }} />
      </div>

      <div className="mt-4">
        <label htmlFor={amountId} className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">
          Amount (mock credits)
        </label>
        <input
          ref={amountInputRef}
          id={amountId}
          type="number"
          min={1}
          max={balance}
          value={amount}
          disabled={!isOpen}
          onChange={(e) => { setAmount(Number(e.target.value)); setError(null); setSuccess(false); }}
          className="h-12 w-full rounded border border-ink/15 bg-chalk px-3 text-lg font-black outline-none focus:border-field disabled:cursor-not-allowed disabled:opacity-50"
          aria-describedby={`${amountHelpId}${amountError ? ` ${amountErrorId}` : ""}`}
          aria-invalid={Boolean(amountError)}
        />
        <p id={amountHelpId} className="mt-1 text-xs font-semibold text-ink/60">
          Available: {credits(balance)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Current price" value={pct(priceBefore)} />
        <Metric label="Est. shares" value={estimatedShares > 0 ? estimatedShares.toFixed(3) : "—"} />
        <Metric label="Avg entry" value={avgEntry > 0 ? pct(avgEntry) : "—"} />
        <Metric label="Balance after" value={credits(Math.max(0, balanceAfter))} highlight={balanceAfter < 0} />
      </div>

      {amountError ? (
        <p id={amountErrorId} role="alert" className="mt-3 rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush">
          {amountError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush">{error}</p>
      ) : null}
      {success ? (
        <p role="status" className="mt-3 rounded bg-field/10 px-3 py-2 text-sm font-bold text-field">
          Trade confirmed!
        </p>
      ) : null}

      <p id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        {isSubmitting ? "Submitting trade." : success ? "Trade confirmed." : error ? "Trade failed." : ""}
      </p>

      <button
        type="button"
        disabled={!canTrade}
        onClick={submit}
        aria-describedby={liveId}
        className="mt-5 h-12 w-full rounded bg-ink text-sm font-black text-white transition hover:bg-field disabled:cursor-not-allowed disabled:bg-ink/30"
      >
        {isSubmitting ? "Confirming..." : `Buy ${side} — ${credits(amount)}`}
      </button>
    </section>
  );
}

function SideButton({
  active,
  label,
  price,
  disabled,
  onClick
}: {
  active: boolean;
  label: Side;
  price: number;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`rounded border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-field bg-field/10"
          : "border-ink/10 bg-chalk hover:border-ink/30"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-widest text-ink/70">{label}</p>
      <p className="mt-1 text-xl font-black">{pct(price)}</p>
    </button>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded border border-ink/10 bg-chalk p-3">
      <p className="text-xs font-black uppercase tracking-widest text-ink/70">{label}</p>
      <p className={`mt-1 text-base font-black ${highlight ? "text-rush" : ""}`}>{value}</p>
    </div>
  );
}
