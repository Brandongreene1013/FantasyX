"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { TradePanel } from "@/components/trade-panel";
import type { Market, Player, Side } from "@/lib/types";

export function TradeLauncher({
  market,
  player,
  initialSide = "YES",
  balance,
  position,
  open,
  onOpenChange,
  onTradeComplete,
  isAuthenticated = true,
  buttonLabel = "Trade",
  showButton = true
}: {
  market: Market;
  player: Player;
  initialSide?: Side;
  balance: number;
  position?: { yesShares: number; noShares: number; currentValue: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTradeComplete: () => void;
  isAuthenticated?: boolean;
  buttonLabel?: string;
  showButton?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const trigger = triggerRef.current;
    const first = getFocusableElements(dialogRef.current)[0];
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (!firstElement || !lastElement) return;
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
      trigger?.focus();
    };
  }, [open, onOpenChange]);

  return (
    <>
      {showButton ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => onOpenChange(true)}
          disabled={market.status !== "OPEN"}
          className="rounded-lg border border-neon/25 bg-neon/10 px-3 py-1.5 text-[10px] font-black text-neon transition-colors hover:bg-neon/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {buttonLabel}
        </button>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/65 p-0 sm:place-items-center sm:p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-rim bg-surface p-3 shadow-2xl sm:rounded-2xl"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 id={titleId} className="text-sm font-black text-frost">Trade Ticket</h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-rim bg-panel2 text-muted transition-colors hover:text-frost"
                aria-label="Close trade ticket"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <TradePanel
              market={market}
              player={player}
              balance={balance}
              position={position}
              initialSide={initialSide}
              onTradeComplete={onTradeComplete}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}
