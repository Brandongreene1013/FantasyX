import type { Market, Side } from "@/lib/types";

export function getYesPrice(market: Pick<Market, "yesPool" | "noPool">) {
  return clamp(market.noPool / (market.yesPool + market.noPool), 0.01, 0.99);
}

export function getNoPrice(market: Pick<Market, "yesPool" | "noPool">) {
  return 1 - getYesPrice(market);
}

export function getSidePrice(market: Market, side: Side) {
  return side === "YES" ? getYesPrice(market) : getNoPrice(market);
}

export function quoteBuy(market: Market, side: Side, spend: number) {
  if (spend <= 0) {
    return { shares: 0, priceBefore: getSidePrice(market, side), priceAfter: getSidePrice(market, side) };
  }

  const k = market.yesPool * market.noPool;
  const priceBefore = getSidePrice(market, side);

  if (side === "YES") {
    const nextNoPool = market.noPool + spend;
    const nextYesPool = k / nextNoPool;
    const nextMarket = { ...market, yesPool: nextYesPool, noPool: nextNoPool };
    return {
      shares: market.yesPool - nextYesPool,
      priceBefore,
      priceAfter: getYesPrice(nextMarket)
    };
  }

  const nextYesPool = market.yesPool + spend;
  const nextNoPool = k / nextYesPool;
  const nextMarket = { ...market, yesPool: nextYesPool, noPool: nextNoPool };

  return {
    shares: market.noPool - nextNoPool,
    priceBefore,
    priceAfter: getNoPrice(nextMarket)
  };
}

export function executeBuy(market: Market, side: Side, spend: number) {
  const quote = quoteBuy(market, side, spend);
  const k = market.yesPool * market.noPool;

  if (side === "YES") {
    const noPool = market.noPool + spend;
    return {
      market: { ...market, noPool, yesPool: k / noPool, liquidity: market.liquidity + spend },
      quote
    };
  }

  const yesPool = market.yesPool + spend;
  return {
    market: { ...market, yesPool, noPool: k / yesPool, liquidity: market.liquidity + spend },
    quote
  };
}

export function quoteSell(market: Market, side: Side, shares: number) {
  if (shares <= 0) {
    return { proceeds: 0, priceBefore: getSidePrice(market, side), priceAfter: getSidePrice(market, side) };
  }

  const k = market.yesPool * market.noPool;
  const priceBefore = getSidePrice(market, side);

  if (side === "YES") {
    const nextYesPool = market.yesPool + shares;
    const nextNoPool = k / nextYesPool;
    const nextMarket = { ...market, yesPool: nextYesPool, noPool: nextNoPool };
    return {
      proceeds: Math.max(0, market.noPool - nextNoPool),
      priceBefore,
      priceAfter: getYesPrice(nextMarket)
    };
  }

  const nextNoPool = market.noPool + shares;
  const nextYesPool = k / nextNoPool;
  const nextMarket = { ...market, yesPool: nextYesPool, noPool: nextNoPool };
  return {
    proceeds: Math.max(0, market.yesPool - nextYesPool),
    priceBefore,
    priceAfter: getNoPrice(nextMarket)
  };
}

export function executeSell(market: Market, side: Side, shares: number) {
  const quote = quoteSell(market, side, shares);
  const k = market.yesPool * market.noPool;

  if (side === "YES") {
    const yesPool = market.yesPool + shares;
    return {
      market: { ...market, yesPool, noPool: k / yesPool, liquidity: Math.max(0, market.liquidity - quote.proceeds) },
      quote
    };
  }

  const noPool = market.noPool + shares;
  return {
    market: { ...market, yesPool: k / noPool, noPool, liquidity: Math.max(0, market.liquidity - quote.proceeds) },
    quote
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
