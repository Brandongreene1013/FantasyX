"use client";

import { useId, useMemo, useState } from "react";
import { getSidePrice, quoteBuy, quoteSell } from "@/lib/amm";
import { apiPost } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { Market, Player, Side } from "@/lib/types";

type TradePosition = {
  yesShares: number;
  noShares: number;
  currentValue: number;
};

export function TradePanel({
  market,
  player,
  balance,
  position,
  onTradeComplete
}: {
  market: Market;
  player: Player;
  balance: number;
  position?: TradePosition | null;
  onTradeComplete: () => void;
}) {
  const [mode, setMode] = useState<"BUY" | "SELL">("BUY");
  const [side, setSide] = useState<Side>("YES");
  const [amount, setAmount] = useState(25);
  const [sellShares, setSellShares] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const amountId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const liveId = useId();

  const isOpen = market.status === "OPEN";
  const ownedShares = side === "YES" ? position?.yesShares ?? 0 : position?.noShares ?? 0;
  const buyQuote = useMemo(() => quoteBuy(market, side, amount), [market, side, amount]);
  const sellQuote = useMemo(() => quoteSell(market, side, sellShares), [market, side, sellShares]);
  const estimatedShares = buyQuote.shares;
  const avgEntry = estimatedShares > 0 ? amount / estimatedShares : 0;
  const balanceAfterBuy = balance - amount;
  const balanceAfterSell = balance + sellQuote.proceeds;

  const inputError =
    mode === "SELL"
      ? sellShares <= 0
        ? "Sell quantity must be greater than zero."
        : sellShares > ownedShares
          ? "Sell quantity exceeds shares owned."
          : null
      : amount <= 0
        ? "Amount must be greater than zero."
        : amount > balance
          ? "Amount exceeds available balance."
          : null;

  const canTrade = isOpen && !isSubmitting && !inputError && (mode === "SELL" ? ownedShares > 0 : amount > 0 && amount <= balance);

  async function submit() {
    if (!canTrade) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await apiPost("/api/trades", mode === "SELL"
        ? { action: "SELL", marketId: market.id, side, shares: sellShares, idempotencyKey: crypto.randomUUID() }
        : { action: "BUY", marketId: market.id, side, spend: amount, idempotencyKey: crypto.randomUUID() });
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
        {player.name} - {thresholdLabel(market.threshold)} - {player.position}
      </p>

      {!isOpen ? (
        <div className="mt-4 rounded bg-ink/5 p-4 text-sm font-bold text-ink/70">
          Market is {market.status.toLowerCase()} and trading is disabled.
          {market.result ? ` Result: ${market.result}.` : ""}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ModeButton active={mode === "BUY"} label="Buy" disabled={!isOpen} onClick={() => changeMode("BUY")} />
        <ModeButton active={mode === "SELL"} label="Sell" disabled={!isOpen} onClick={() => changeMode("SELL")} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <SideButton active={side === "YES"} label="YES" price={getSidePrice(market, "YES")} disabled={!isOpen} onClick={() => changeSide("YES")} />
        <SideButton active={side === "NO"} label="NO" price={getSidePrice(market, "NO")} disabled={!isOpen} onClick={() => changeSide("NO")} />
      </div>

      {position && (position.yesShares > 0 || position.noShares > 0) ? (
        <div className="mt-4 rounded border border-field/20 bg-field/5 p-3 text-xs font-bold text-ink/70">
          Position: YES {position.yesShares.toFixed(3)} / NO {position.noShares.toFixed(3)} - est. value {credits(position.currentValue)}
        </div>
      ) : null}

      <div className="mt-4">
        <label htmlFor={amountId} className="mb-1 block text-xs font-black uppercase tracking-widest text-ink/70">
          {mode === "SELL" ? "Shares to sell" : "Amount (mock credits)"}
        </label>
        <input
          id={amountId}
          type="number"
          min={mode === "SELL" ? 0.000001 : 1}
          step={mode === "SELL" ? 0.000001 : 1}
          max={mode === "SELL" ? ownedShares : balance}
          value={mode === "SELL" ? sellShares : amount}
          disabled={!isOpen}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (mode === "SELL") setSellShares(value);
            else setAmount(value);
            setError(null);
            setSuccess(false);
          }}
          className="h-12 w-full rounded border border-ink/15 bg-chalk px-3 text-lg font-black outline-none focus:border-field disabled:cursor-not-allowed disabled:opacity-50"
          aria-describedby={`${amountHelpId}${inputError ? ` ${amountErrorId}` : ""}`}
          aria-invalid={Boolean(inputError)}
        />
        <p id={amountHelpId} className="mt-1 text-xs font-semibold text-ink/60">
          {mode === "SELL" ? `Owned ${side}: ${ownedShares.toFixed(6)} shares` : `Available: ${credits(balance)}`}
        </p>
        {mode === "SELL" && ownedShares > 0 ? (
          <button className="mt-2 rounded border border-ink/10 px-3 py-1.5 text-xs font-black hover:bg-ink/5" type="button" onClick={() => setSellShares(ownedShares)}>
            Sell all {side}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Current price" value={pct(getSidePrice(market, side))} />
        <Metric label={mode === "SELL" ? "Est. proceeds" : "Est. shares"} value={mode === "SELL" ? credits(sellQuote.proceeds) : estimatedShares > 0 ? estimatedShares.toFixed(3) : "-"} />
        <Metric label={mode === "SELL" ? "Owned side" : "Avg entry"} value={mode === "SELL" ? ownedShares.toFixed(3) : avgEntry > 0 ? pct(avgEntry) : "-"} />
        <Metric label="Balance after" value={credits(mode === "SELL" ? balanceAfterSell : Math.max(0, balanceAfterBuy))} highlight={mode === "BUY" && balanceAfterBuy < 0} />
      </div>

      {inputError ? <p id={amountErrorId} role="alert" className="mt-3 rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush">{inputError}</p> : null}
      {error ? <p role="alert" className="mt-3 rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush">{error}</p> : null}
      {success ? <p role="status" className="mt-3 rounded bg-field/10 px-3 py-2 text-sm font-bold text-field">Trade confirmed.</p> : null}

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
        {isSubmitting ? "Confirming..." : mode === "SELL" ? `Sell ${side} - ${sellShares.toFixed(3)} shares` : `Buy ${side} - ${credits(amount)}`}
      </button>
    </section>
  );

  function changeMode(nextMode: "BUY" | "SELL") {
    setMode(nextMode);
    setError(null);
    setSuccess(false);
  }

  function changeSide(nextSide: Side) {
    setSide(nextSide);
    setError(null);
    setSuccess(false);
  }
}

function ModeButton({ active, label, disabled, onClick }: { active: boolean; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={active} className={`rounded border p-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-field bg-field/10" : "border-ink/10 bg-chalk hover:border-ink/30"}`}>
      {label}
    </button>
  );
}

function SideButton({ active, label, price, disabled, onClick }: { active: boolean; label: Side; price: number; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={active} className={`rounded border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-field bg-field/10" : "border-ink/10 bg-chalk hover:border-ink/30"}`}>
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
