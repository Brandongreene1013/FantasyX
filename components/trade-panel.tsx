"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CheckCircle2, Zap } from "lucide-react";
import { getSidePrice, quoteBuy, quoteSell } from "@/lib/amm";
import { apiPost } from "@/lib/client-api";
import { credits, pct, thresholdLabel } from "@/lib/format";
import type { Market, Player, Side } from "@/lib/types";
import { AuthRequiredState } from "@/components/auth-required-state";

type TradePosition = { yesShares: number; noShares: number; currentValue: number };

const QUICK_AMOUNTS = [25, 50, 100, 250] as const;
const SELL_PCTS = [25, 50, 75] as const;

export function TradePanel({
  market, player, balance, position, initialSide = "YES", initialAction = "BUY", onTradeComplete,
  isAuthenticated = true, returnTo
}: {
  market: Market; player: Player; balance: number;
  position?: TradePosition | null; initialSide?: Side; initialAction?: "BUY" | "SELL";
  onTradeComplete: () => void; isAuthenticated?: boolean; returnTo?: string;
}) {
  const [mode, setMode]         = useState<"BUY" | "SELL">(initialAction);
  const [side, setSide]         = useState<Side>(initialSide);
  const [amount, setAmount]     = useState(50);
  const [sellShares, setSellShares] = useState(1);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountId  = useId();
  const liveId    = useId();
  const errId     = useId();

  const isOpen       = market.status === "OPEN";
  const ownedShares  = side === "YES" ? (position?.yesShares ?? 0) : (position?.noShares ?? 0);
  const buyQuote     = useMemo(() => quoteBuy(market, side, amount),        [market, side, amount]);
  const sellQuote    = useMemo(() => quoteSell(market, side, sellShares),   [market, side, sellShares]);
  const estShares    = buyQuote.shares;
  const avgEntry     = estShares > 0 ? amount / estShares : 0;
  const balAfterBuy  = balance - amount;
  const balAfterSell = balance + sellQuote.proceeds;
  const priceImpact  = mode === "SELL"
    ? Math.abs(sellQuote.priceAfter - sellQuote.priceBefore)
    : Math.abs(buyQuote.priceAfter - buyQuote.priceBefore);
  const maxLoss = mode === "BUY" ? amount : 0;
  const potentialSettlement = mode === "BUY" ? estShares : Math.max(0, ownedShares - sellShares);

  useEffect(() => {
    setSide(initialSide);
    setMode(initialAction);
    setAmount(50);
    setSellShares(1);
    setError(null);
    setSuccess(false);
  }, [market.id, initialAction, initialSide]);

  const inputError = mode === "SELL"
    ? (sellShares <= 0 ? "Must be > 0" : sellShares > ownedShares ? "Exceeds shares owned" : null)
    : (amount <= 0 ? "Must be > 0" : amount > balance ? "Insufficient balance" : null);

  const canTrade = isOpen && !isSubmitting && !inputError &&
    (mode === "SELL" ? ownedShares > 0 : amount > 0 && amount <= balance);

  async function submit() {
    if (!canTrade) return;
    setIsSubmitting(true); setError(null); setSuccess(false);
    try {
      await apiPost("/api/trades", mode === "SELL"
        ? { action: "SELL", marketId: market.id, side, shares: sellShares, expectedPrice: getSidePrice(market, side), maxSlippageBps: 200, idempotencyKey: crypto.randomUUID() }
        : { action: "BUY",  marketId: market.id, side, spend: amount, expectedPrice: getSidePrice(market, side), maxSlippageBps: 200, idempotencyKey: crypto.randomUUID() });
      setSuccess(true);
      onTradeComplete();
      window.dispatchEvent(new Event("fantasyx:data-changed"));
      setTimeout(() => { setSuccess(false); }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(m: "BUY" | "SELL") { setMode(m); setError(null); setSuccess(false); }
  function changeSide(s: Side)            { setSide(s); setError(null); setSuccess(false); }
  function setSellPercent(percent: number) {
    const next = percent >= 1 ? ownedShares : Math.floor(ownedShares * percent * 1_000_000) / 1_000_000;
    setSellShares(next);
    setError(null);
    setSuccess(false);
  }

  if (!isAuthenticated) {
    return (
      <AuthRequiredState
        compact
        title="Log in to trade"
        description={`Explore ${player.name} ${thresholdLabel(market.threshold)} freely. Log in or create an account when you are ready to place a free-play trade.`}
        next={returnTo ?? `/players/${player.id}?threshold=${market.threshold}`}
      />
    );
  }

  // ── Success overlay ────────────────────────────────────────────
  if (success) {
    return (
      <section aria-live="polite" className="rounded-2xl border border-neon/30 bg-neon/5 p-6 text-center animate-scale-in glow-neon-sm">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neon/15 border border-neon/30 animate-pop">
          <CheckCircle2 className="h-7 w-7 text-neon" />
        </div>
        <p className="text-lg font-black text-neon">Trade Confirmed</p>
        <p className="mt-1 text-sm font-semibold text-muted">
          {mode === "BUY" ? `Bought ${side} · ${estShares.toFixed(2)} shares` : `Sold ${side} · ${credits(sellQuote.proceeds)} received`}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Trade panel" className="rounded-2xl border border-rim bg-panel card-depth">
      {/* Header */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-neon" aria-hidden />
          <h2 className="text-sm font-black text-frost">Trade</h2>
        </div>
        <p className="text-[11px] font-semibold text-muted">
          {player.team} vs {player.opponent || "TBD"} · Week {market.week}
        </p>
        <p className="text-[11px] font-semibold text-muted">
          {player.name} · {thresholdLabel(market.threshold)} · {player.position}
        </p>
      </div>

      {!isOpen && (
        <div className="mx-5 mt-4 rounded-xl bg-rim/40 px-4 py-3 text-sm font-semibold text-muted">
          Market {market.status.toLowerCase()} - trading disabled.{market.result ? ` Result: ${market.result}.` : ""}
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Buy / Sell toggle */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-rim bg-surface p-1">
          {(["BUY", "SELL"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={!isOpen}
              onClick={() => changeMode(m)}
              aria-pressed={mode === m}
              className={`h-9 rounded-lg text-xs font-black transition-all ${
                mode === m
                  ? m === "BUY"
                    ? "bg-neon text-surface shadow-glow-sm"
                    : "bg-crimson text-white"
                  : "text-muted hover:text-frost"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* YES / NO toggle */}
        <div className="grid grid-cols-2 gap-2">
          {(["YES", "NO"] as const).map((s) => {
            const price = getSidePrice(market, s);
            const isYes = s === "YES";
            const active = side === s;
            return (
              <button
                key={s}
                type="button"
                disabled={!isOpen}
                onClick={() => changeSide(s)}
                aria-pressed={active}
                className={`rounded-xl border p-3 text-left transition-all ${
                  active
                    ? isYes
                      ? "border-neon/50 bg-neon/10 glow-neon-sm"
                      : "border-crimson/50 bg-crimson/10 glow-crimson"
                    : "border-rim bg-panel2 hover:border-rim/80"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <p className={`text-[10px] font-black uppercase tracking-wider ${active ? (isYes ? "text-neon" : "text-crimson") : "text-muted"}`}>{s}</p>
                <p className={`mt-1 text-xl font-black ${active ? (isYes ? "text-neon" : "text-crimson") : "text-frost"}`}>{pct(price)}</p>
              </button>
            );
          })}
        </div>

        {/* Position hint */}
        {position && (position.yesShares > 0 || position.noShares > 0) && (
          <div className="rounded-xl bg-panel2 px-3 py-2 text-[10px] font-semibold text-muted">
            Position: YES {position.yesShares.toFixed(2)} sh · NO {position.noShares.toFixed(2)} sh · val {credits(position.currentValue)}
          </div>
        )}

        {/* Amount input */}
        {mode === "BUY" ? (
          <div>
            {/* Quick amounts */}
            <div className="flex gap-1.5 mb-2">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setAmount(q); setError(null); setSuccess(false); }}
                  className={`flex-1 rounded-lg border py-1.5 text-[10px] font-black transition-all ${
                    amount === q
                      ? "border-neon/40 bg-neon/10 text-neon"
                      : "border-rim bg-panel2 text-muted hover:text-frost hover:border-rim/80"
                  }`}
                >
                  {q}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setAmount(Math.floor(balance)); setError(null); setSuccess(false); }}
                className={`flex-1 rounded-lg border py-1.5 text-[10px] font-black transition-all ${
                  amount === Math.floor(balance)
                    ? "border-amber/40 bg-amber/10 text-amber"
                    : "border-rim bg-panel2 text-muted hover:text-frost hover:border-rim/80"
                }`}
              >
                MAX
              </button>
            </div>
            <label htmlFor={amountId} className="sr-only">Amount in mock credits</label>
            <input
              id={amountId}
              type="number"
              min={1}
              max={balance}
              value={amount}
              disabled={!isOpen}
              onChange={(e) => { setAmount(Number(e.target.value)); setError(null); setSuccess(false); }}
              className="h-12 w-full rounded-xl border border-rim bg-panel2 px-4 text-lg font-black text-frost outline-none focus:border-neon/50 transition-colors disabled:opacity-50"
              aria-describedby={errId}
              aria-invalid={Boolean(inputError)}
            />
            <p className="mt-1 text-[10px] font-semibold text-muted">Available: {credits(balance)}</p>
          </div>
        ) : (
          <div>
            <label htmlFor={amountId} className="block mb-1 text-[10px] font-black uppercase tracking-wider text-muted">Shares to sell</label>
            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {SELL_PCTS.map((percent) => (
                <button
                  key={percent}
                  type="button"
                  disabled={!isOpen || ownedShares <= 0}
                  onClick={() => setSellPercent(percent / 100)}
                  className="rounded-lg border border-rim bg-panel2 py-1.5 text-[10px] font-black text-muted transition-colors hover:text-frost disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {percent}%
                </button>
              ))}
              <button
                type="button"
                disabled={!isOpen || ownedShares <= 0}
                onClick={() => setSellPercent(1)}
                className="rounded-lg border border-crimson/25 bg-crimson/10 py-1.5 text-[10px] font-black text-crimson transition-colors hover:bg-crimson/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                MAX
              </button>
            </div>
            <div className="flex gap-2">
              <input
                id={amountId}
                type="number"
                min={0.000001}
                step={0.000001}
                max={ownedShares}
                value={sellShares}
                disabled={!isOpen}
                onChange={(e) => { setSellShares(Number(e.target.value)); setError(null); setSuccess(false); }}
                className="h-12 flex-1 rounded-xl border border-rim bg-panel2 px-4 text-lg font-black text-frost outline-none focus:border-crimson/50 transition-colors disabled:opacity-50"
              />
            </div>
            <p className="mt-1 text-[10px] font-semibold text-muted">Owned {side}: {ownedShares.toFixed(4)} sh</p>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Price" value={pct(getSidePrice(market, side))} />
          <Metric label={mode === "SELL" ? "Est. proceeds" : "Est. shares"} value={mode === "SELL" ? credits(sellQuote.proceeds) : (estShares > 0 ? estShares.toFixed(3) : "--")} />
          <Metric label={mode === "SELL" ? "Shares owned" : "Avg entry"} value={mode === "SELL" ? ownedShares.toFixed(3) : (avgEntry > 0 ? pct(avgEntry) : "--")} />
          <Metric label="Price impact" value={pct(priceImpact)} />
          <Metric label={mode === "SELL" ? "Remaining" : "Max loss"} value={mode === "SELL" ? Math.max(0, ownedShares - sellShares).toFixed(3) : credits(maxLoss)} />
          <Metric label={mode === "SELL" ? "Position effect" : "Settle value"} value={mode === "SELL" ? credits(sellQuote.proceeds) : credits(potentialSettlement)} />
          <Metric
            label="Balance after"
            value={credits(mode === "SELL" ? balAfterSell : Math.max(0, balAfterBuy))}
            tone={mode === "BUY" && balAfterBuy < 0 ? "danger" : "default"}
          />
        </div>

        {/* Errors */}
        {(inputError ?? error) && (
          <p id={errId} role="alert" className="rounded-xl bg-crimson/10 border border-crimson/20 px-4 py-2 text-sm font-bold text-crimson">
            {inputError ?? error}
          </p>
        )}

        {/* Submit */}
        <button
          type="button"
          disabled={!canTrade}
          onClick={submit}
          className={`h-13 w-full rounded-xl text-sm font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
            !canTrade
              ? "bg-rim text-muted"
              : mode === "BUY"
                ? side === "YES"
                  ? "bg-neon text-surface hover:bg-neon/90 shadow-glow-sm"
                  : "bg-crimson text-white hover:bg-crimson/90 shadow-glow-crimson"
                : "bg-panel2 border border-rim text-frost hover:border-frost/20"
          }`}
          aria-describedby={liveId}
        >
          {isSubmitting
            ? "Confirming…"
            : mode === "BUY"
              ? `Buy ${estShares.toFixed(2)} ${side} Shares`
              : `Sell ${sellShares.toFixed(2)} ${side} Shares`
          }
        </button>
      </div>

      <p id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        {isSubmitting ? "Submitting trade." : error ? "Trade failed." : ""}
      </p>
    </section>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-xl bg-panel2 px-3 py-2.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-black ${tone === "danger" ? "text-crimson" : "text-frost"}`}>{value}</p>
    </div>
  );
}
