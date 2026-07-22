import { executeBuy, getSidePrice } from "@/lib/amm";
import type { Market, Side } from "@/lib/types";

export type MarketDepthLevel = {
  price: number;
  shares: number;
  notional: number;
  cumulativeShares: number;
};

export type MarketDepth = {
  side: Side;
  midpoint: number;
  spread: number;
  asks: MarketDepthLevel[];
  bids: MarketDepthLevel[];
};

const DEFAULT_LEVELS = 5;

export function buildMarketDepth(market: Market, side: Side, levelCount = DEFAULT_LEVELS): MarketDepth {
  const levels = Math.max(1, Math.min(8, Math.floor(levelCount)));
  const liquidity = Math.max(1, market.yesPool + market.noPool);
  const notionalStep = clamp(liquidity * 0.02, 5, 50);
  const midpoint = getSidePrice(market, side);
  const oppositeSide: Side = side === "YES" ? "NO" : "YES";

  let askMarket = { ...market };
  let bidMarket = { ...market };
  let askShares = 0;
  let bidShares = 0;
  const asks: MarketDepthLevel[] = [];
  const bids: MarketDepthLevel[] = [];

  for (let index = 0; index < levels; index += 1) {
    const askExecution = executeBuy(askMarket, side, notionalStep);
    const askPrice = clamp((askExecution.quote.priceBefore + askExecution.quote.priceAfter) / 2, 0.01, 0.99);
    const askSize = notionalStep / askPrice;
    askShares += askSize;
    asks.push({
      price: askPrice,
      shares: askSize,
      notional: notionalStep,
      cumulativeShares: askShares
    });
    askMarket = askExecution.market;

    const bidExecution = executeBuy(bidMarket, oppositeSide, notionalStep);
    const oppositeAsk = (bidExecution.quote.priceBefore + bidExecution.quote.priceAfter) / 2;
    const bidPrice = clamp(1 - oppositeAsk, 0.01, 0.99);
    const bidSize = notionalStep / bidPrice;
    bidShares += bidSize;
    bids.push({
      price: bidPrice,
      shares: bidSize,
      notional: notionalStep,
      cumulativeShares: bidShares
    });
    bidMarket = bidExecution.market;
  }

  return {
    side,
    midpoint,
    spread: Math.max(0, asks[0].price - bids[0].price),
    asks,
    bids
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
