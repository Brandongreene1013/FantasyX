"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { executeBuy, getNoPrice, getYesPrice } from "@/lib/amm";
import { markets as seedMarkets, mockAccount, players, sampleLeaderboard } from "@/lib/sample-data";
import type { Account, LeaderboardRow, Market, MarketStatus, PositionLot, SettlementResult, Side, Trade } from "@/lib/types";

type FantasyXState = {
  account: Account;
  markets: Market[];
  positions: PositionLot[];
  trades: Trade[];
  buyShares: (marketId: string, side: Side, spend: number) => void;
  settleMarket: (marketId: string, result: Exclude<SettlementResult, null>) => void;
  settlePlayerMarkets: (playerId: string, rank: number) => void;
  setMarketStatus: (marketId: string, status: MarketStatus) => void;
  voidMarket: (marketId: string) => void;
  resetDemo: () => void;
  leaderboard: LeaderboardRow[];
};

const storageKey = "fantasyx-demo-state";
const StoreContext = createContext<FantasyXState | null>(null);

type PersistedState = Pick<FantasyXState, "account" | "markets" | "positions" | "trades">;

const initialState: PersistedState = {
  account: mockAccount,
  markets: seedMarkets,
  positions: [],
  trades: []
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      setState(migrateState(JSON.parse(raw) as PersistedState));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const value = useMemo<FantasyXState>(() => {
    function buyShares(marketId: string, side: Side, spend: number) {
      setState((current) => {
        const market = current.markets.find((item) => item.id === marketId);
        if (!market || market.status !== "OPEN" || spend <= 0 || spend > current.account.balance) {
          return current;
        }

        const executed = executeBuy(market, side, spend);
        const nextMarkets = current.markets.map((item) => (item.id === marketId ? executed.market : item));
        const existing = current.positions.find((item) => item.marketId === marketId);
        const nextPosition: PositionLot = existing
          ? {
              ...existing,
              yesShares: existing.yesShares + (side === "YES" ? executed.quote.shares : 0),
              noShares: existing.noShares + (side === "NO" ? executed.quote.shares : 0),
              costBasis: existing.costBasis + spend
            }
          : {
              marketId,
              yesShares: side === "YES" ? executed.quote.shares : 0,
              noShares: side === "NO" ? executed.quote.shares : 0,
              costBasis: spend
            };

        const trade: Trade = {
          id: crypto.randomUUID(),
          marketId,
          side,
          spend,
          shares: executed.quote.shares,
          priceBefore: executed.quote.priceBefore,
          priceAfter: executed.quote.priceAfter,
          createdAt: new Date().toISOString()
        };

        return {
          account: { ...current.account, balance: current.account.balance - spend },
          markets: nextMarkets,
          positions: existing
            ? current.positions.map((item) => (item.marketId === marketId ? nextPosition : item))
            : [...current.positions, nextPosition],
          trades: [trade, ...current.trades]
        };
      });
    }

    function settleMarket(marketId: string, result: Exclude<SettlementResult, null>) {
      setState((current) => settleMarkets(current, [marketId], () => result));
    }

    function settlePlayerMarkets(playerId: string, rank: number) {
      setState((current) => {
        const marketIds = current.markets.filter((market) => market.playerId === playerId).map((market) => market.id);
        return settleMarkets(current, marketIds, (market) => (rank <= thresholdToRank(market.threshold) ? "YES" : "NO"));
      });
    }

    function setMarketStatus(marketId: string, status: MarketStatus) {
      setState((current) => ({
        ...current,
        markets: current.markets.map((market) =>
          market.id === marketId ? { ...market, status, result: status === "OPEN" || status === "LOCKED" || status === "VOID" ? null : market.result } : market
        )
      }));
    }

    function voidMarket(marketId: string) {
      setState((current) => voidMarkets(current, [marketId]));
    }

    function resetDemo() {
      setState(initialState);
      window.localStorage.removeItem(storageKey);
    }

    const userPnl = calculatePnl(state.account, state.markets, state.positions);
    const leaderboard = [
      ...sampleLeaderboard,
      { id: state.account.id, name: state.account.name, pnl: userPnl, balance: state.account.balance + markedValue(state.markets, state.positions) }
    ].sort((a, b) => b.pnl - a.pnl);

    return { ...state, buyShares, settleMarket, settlePlayerMarkets, setMarketStatus, voidMarket, resetDemo, leaderboard };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useFantasyX() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useFantasyX must be used inside StoreProvider");
  }
  return context;
}

export function getPlayer(playerId: string) {
  return players.find((player) => player.id === playerId);
}

export function markedValue(markets: Market[], positions: PositionLot[]) {
  return positions.reduce((total, position) => {
    const market = markets.find((item) => item.id === position.marketId);
    if (!market) {
      return total;
    }
    if (market.status === "SETTLED" || market.status === "VOID") {
      return total;
    }
    return total + position.yesShares * getYesPrice(market) + position.noShares * getNoPrice(market);
  }, 0);
}

export function calculatePnl(account: Account, markets: Market[], positions: PositionLot[]) {
  return account.balance + markedValue(markets, positions) - account.startingBalance;
}

function voidMarkets(current: PersistedState, marketIds: string[]): PersistedState {
  let refund = 0;
  const voidSet = new Set(marketIds);

  const nextMarkets = current.markets.map((market) => {
    if (!voidSet.has(market.id) || market.status === "SETTLED" || market.status === "VOID") {
      return market;
    }

    return {
      ...market,
      status: "VOID" as const,
      result: null
    };
  });

  const nextPositions = current.positions.map((position) => {
    const market = nextMarkets.find((item) => item.id === position.marketId);
    const wasAlreadyPaid = position.realizedPayout !== undefined;
    if (!market || !voidSet.has(market.id) || market.status !== "VOID" || wasAlreadyPaid) {
      return position;
    }

    refund += position.costBasis;
    return {
      ...position,
      realizedPayout: position.costBasis
    };
  });

  return {
    ...current,
    account: {
      ...current.account,
      balance: current.account.balance + refund
    },
    markets: nextMarkets,
    positions: nextPositions
  };
}

function settleMarkets(
  current: PersistedState,
  marketIds: string[],
  resolveResult: (market: Market) => Exclude<SettlementResult, null>
): PersistedState {
  let payout = 0;
  const settlementSet = new Set(marketIds);

  const nextMarkets = current.markets.map((market) => {
    if (!settlementSet.has(market.id) || market.status === "SETTLED" || market.status === "VOID") {
      return market;
    }

    return {
      ...market,
      status: "SETTLED" as const,
      result: resolveResult(market)
    };
  });

  const nextPositions = current.positions.map((position) => {
    const market = nextMarkets.find((item) => item.id === position.marketId);
    const wasAlreadyPaid = position.realizedPayout !== undefined;
    if (!market || !settlementSet.has(market.id) || market.status !== "SETTLED" || wasAlreadyPaid) {
      return position;
    }

    const positionPayout = market.result === "YES" ? position.yesShares : position.noShares;
    payout += positionPayout;
    return {
      ...position,
      realizedPayout: positionPayout
    };
  });

  return {
    ...current,
    account: {
      ...current.account,
      balance: current.account.balance + payout
    },
    markets: nextMarkets,
    positions: nextPositions
  };
}

function thresholdToRank(threshold: Market["threshold"]) {
  if (threshold === "TOP_3") {
    return 3;
  }
  if (threshold === "TOP_5") {
    return 5;
  }
  return 10;
}

function migrateState(state: PersistedState): PersistedState {
  return {
    ...state,
    markets: state.markets.map((market) => ({
      ...market,
      status: market.status === ("CLOSED" as MarketStatus) ? "LOCKED" : market.status
    }))
  };
}
