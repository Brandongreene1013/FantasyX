import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type MarketStatus } from "@prisma/client";
import { executeBuy, getYesPrice } from "@/lib/amm";
import { executeDbBuy, lockDbMarket, openDbMarket, settleDbMarket, voidDbMarket } from "@/lib/db-amm";
import { toNumber } from "@/lib/db-serialization";
import type { Market } from "@/lib/types";
import { POST as postTrade } from "@/app/api/trades/route";
import { GET as getTradeHistory } from "@/app/api/trade-history/route";
import { GET as getPortfolio } from "@/app/api/portfolio/route";
import { sessionCookieName } from "@/lib/session";
import { createSession } from "@/lib/session-store";
import { csrfTokenForRequest } from "@/lib/csrf";
import { applyLedgerBalanceChange, calculateLedgerBalance, reconcileUserLedger } from "@/lib/ledger-service";

const prisma = new PrismaClient();
const weekId = "test_week_money_market";
const gameId = "test_game_money_market";
const playerId = "test_player_money_market";
const userId = "test_user_money_market";
const otherUserId = "test_other_user_money_market";
let userSessionCookie = "";

describe("AMM pricing", () => {
  it("buying YES increases YES price", () => {
    const market = makeClientMarket();
    const before = getYesPrice(market);
    const executed = executeBuy(market, "YES", 50);

    expect(getYesPrice(executed.market)).toBeGreaterThan(before);
  });

  it("buying NO decreases YES price", () => {
    const market = makeClientMarket();
    const before = getYesPrice(market);
    const executed = executeBuy(market, "NO", 50);

    expect(getYesPrice(executed.market)).toBeLessThan(before);
  });
});

describe("ledger math", () => {
  it("calculates balance from signed ledger entries", () => {
    expect(calculateLedgerBalance([{ amount: 1000 }, { amount: -125.5 }, { amount: 18.25 }])).toBeCloseTo(892.75);
  });
});

describe("database-backed trading and settlement", () => {
  beforeEach(async () => {
    await resetTestData();
    await createBaseData();
  });

  afterAll(async () => {
    await resetTestData();
    await prisma.$disconnect();
  });

  it("creates seed grant ledger entries for starting balances", async () => {
    const entries = await prisma.accountLedgerEntry.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    const reconciliation = await prisma.$transaction((tx) => reconcileUserLedger(tx, userId));

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("SEED_GRANT");
    expect(toNumber(entries[0].amount)).toBeCloseTo(1000);
    expect(toNumber(entries[0].balanceAfter)).toBeCloseTo(1000);
    expect(entries[0].idempotencyKey).toBe(`test_seed_grant:${userId}`);
    expect(reconciliation).toMatchObject({
      ledgerBalance: 1000,
      storedBalance: 1000,
      difference: 0,
      isBalanced: true,
      entryCount: 1
    });
  });

  it("decreases user balance by spend and increases position shares", async () => {
    const before = await getUserBalance();
    const trade = await prisma.$transaction((tx) =>
      executeDbBuy(tx, {
        userId,
        marketId: marketId("TOP_3"),
        side: "YES",
        spend: 100
      })
    );

    const after = await getUserBalance();
    const position = await prisma.position.findUniqueOrThrow({
      where: { userId_marketId: { userId, marketId: marketId("TOP_3") } }
    });

    expect(after).toBeCloseTo(before - 100);
    expect(toNumber(position.yesShares)).toBeCloseTo(toNumber(trade.shares));
    expect(toNumber(position.noShares)).toBe(0);
    expect(toNumber(position.costBasis)).toBeCloseTo(100);
  });

  it("reconciles user balance from the append-only ledger", async () => {
    await prisma.$transaction((tx) =>
      executeDbBuy(tx, {
        userId,
        marketId: marketId("TOP_3"),
        side: "YES",
        spend: 100
      })
    );

    const entries = await prisma.accountLedgerEntry.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    const ledgerDelta = entries.reduce((total, entry) => total + toNumber(entry.amount), 0);
    const reconciliation = await prisma.$transaction((tx) => reconcileUserLedger(tx, userId));

    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("SEED_GRANT");
    expect(entries[1].type).toBe("TRADE_SPEND");
    expect(toNumber(entries[1].amount)).toBeCloseTo(-100);
    expect(toNumber(entries[1].balanceAfter)).toBeCloseTo(900);
    expect(ledgerDelta).toBeCloseTo(await getUserBalance(userId));
    expect(reconciliation.isBalanced).toBe(true);
    expect(reconciliation.ledgerBalance).toBeCloseTo(900);
    expect(reconciliation.difference).toBeCloseTo(0);
  });

  it("prevents duplicate balance changes with ledger idempotency keys", async () => {
    await prisma.$transaction((tx) =>
      applyLedgerBalanceChange(tx, {
        userId,
        type: "ADMIN_ADJUSTMENT",
        amount: 25,
        adminId: userId,
        idempotencyKey: "test_admin_adjustment_once",
        reason: "Test adjustment",
        metadata: { source: "unit-test" }
      })
    );

    await expect(
      prisma.$transaction((tx) =>
        applyLedgerBalanceChange(tx, {
          userId,
          type: "ADMIN_ADJUSTMENT",
          amount: 25,
          adminId: userId,
          idempotencyKey: "test_admin_adjustment_once",
          reason: "Duplicate adjustment",
          metadata: { source: "unit-test" }
        })
      )
    ).rejects.toThrow("Duplicate ledger idempotency key");

    expect(await getUserBalance(userId)).toBeCloseTo(1025);
  });

  it("stores ledger metadata, admin attribution, and correction entries", async () => {
    await prisma.$transaction((tx) =>
      applyLedgerBalanceChange(tx, {
        userId,
        type: "CORRECTION",
        amount: -10,
        adminId: userId,
        idempotencyKey: "test_correction_entry",
        reason: "Correct manual test balance",
        metadata: { ticket: "FX-001", previousBalance: 1000 }
      })
    );

    const entry = await prisma.accountLedgerEntry.findUniqueOrThrow({
      where: { idempotencyKey: "test_correction_entry" }
    });
    const reconciliation = await prisma.$transaction((tx) => reconcileUserLedger(tx, userId));

    expect(entry.type).toBe("CORRECTION");
    expect(entry.adminId).toBe(userId);
    expect(entry.metadata).toEqual({ ticket: "FX-001", previousBalance: 1000 });
    expect(reconciliation.isBalanced).toBe(true);
    expect(reconciliation.storedBalance).toBeCloseTo(990);
  });

  it("reports clear reconciliation mismatches for untracked balance mutations", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { mockBalance: 1234 }
    });

    const reconciliation = await prisma.$transaction((tx) => reconcileUserLedger(tx, userId));

    expect(reconciliation.isBalanced).toBe(false);
    expect(reconciliation.ledgerBalance).toBeCloseTo(1000);
    expect(reconciliation.storedBalance).toBeCloseTo(1234);
    expect(reconciliation.difference).toBeCloseTo(234);
  });

  it.each(["LOCKED", "SETTLED", "VOID"] as MarketStatus[])("cannot trade when market is %s", async (status) => {
    await prisma.market.update({
      where: { id: marketId("TOP_3") },
      data: {
        status,
        result: status === "SETTLED" ? "YES" : null
      }
    });

    await expect(
      prisma.$transaction((tx) =>
        executeDbBuy(tx, {
          userId,
          marketId: marketId("TOP_3"),
          side: "YES",
          spend: 25
        })
      )
    ).rejects.toThrow("Market is not open");
  });

  it("does not allow spending more than balance", async () => {
    await expect(
      prisma.$transaction((tx) =>
        executeDbBuy(tx, {
          userId,
          marketId: marketId("TOP_3"),
          side: "YES",
          spend: 1001
        })
      )
    ).rejects.toThrow("Insufficient mock credit balance");
  });

  it("ignores forged client userId and trades as the session user", async () => {
    const request = new Request("http://localhost/api/trades", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...csrfHeaders(userSessionCookie)
      },
      body: JSON.stringify({
        userId: otherUserId,
        marketId: marketId("TOP_10"),
        side: "YES",
        spend: 40
      })
    });

    const response = await postTrade(request);
    expect(response.status).toBe(200);

    expect(await getUserBalance(userId)).toBeCloseTo(960);
    expect(await getUserBalance(otherUserId)).toBeCloseTo(1000);

    const sessionPosition = await prisma.position.findUnique({
      where: { userId_marketId: { userId, marketId: marketId("TOP_10") } }
    });
    const forgedPosition = await prisma.position.findUnique({
      where: { userId_marketId: { userId: otherUserId, marketId: marketId("TOP_10") } }
    });

    expect(sessionPosition).not.toBeNull();
    expect(forgedPosition).toBeNull();
  });

  it("sells YES shares, credits balance, reduces position, and writes proceeds ledger", async () => {
    const buy = await prisma.$transaction((tx) =>
      executeDbBuy(tx, { userId, marketId: marketId("TOP_10"), side: "YES", spend: 100 })
    );

    const response = await postTrade(tradeRequest({ action: "SELL", marketId: marketId("TOP_10"), side: "YES", shares: toNumber(buy.shares) / 2, idempotencyKey: "sell_yes_test_key" }));
    expect(response.status).toBe(200);

    const position = await prisma.position.findUniqueOrThrow({ where: { userId_marketId: { userId, marketId: marketId("TOP_10") } } });
    const ledger = await prisma.accountLedgerEntry.findFirstOrThrow({ where: { userId, type: "TRADE_PROCEEDS" }, orderBy: { createdAt: "desc" } });
    const sellTrade = await prisma.trade.findFirstOrThrow({ where: { idempotencyKey: "sell_yes_test_key" } });

    expect(toNumber(position.yesShares)).toBeCloseTo(toNumber(buy.shares) / 2);
    expect(toNumber(ledger.amount)).toBeGreaterThan(0);
    expect(sellTrade.action).toBe("SELL");
    expect(await getUserBalance(userId)).toBeGreaterThan(900);
  });

  it("sells NO shares", async () => {
    const buy = await prisma.$transaction((tx) =>
      executeDbBuy(tx, { userId, marketId: marketId("TOP_5"), side: "NO", spend: 80 })
    );

    const response = await postTrade(tradeRequest({ action: "SELL", marketId: marketId("TOP_5"), side: "NO", shares: toNumber(buy.shares), idempotencyKey: "sell_no_test_key" }));
    expect(response.status).toBe(200);

    const position = await prisma.position.findUniqueOrThrow({ where: { userId_marketId: { userId, marketId: marketId("TOP_5") } } });
    expect(toNumber(position.noShares)).toBeCloseTo(0);
  });

  it("rejects selling more shares than owned", async () => {
    await prisma.$transaction((tx) =>
      executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 50 })
    );

    const response = await postTrade(tradeRequest({ action: "SELL", marketId: marketId("TOP_3"), side: "YES", shares: 9999, idempotencyKey: "oversell_test_key" }));
    expect(response.status).toBe(400);
    const body = await response.json() as { code: string };
    expect(body.code).toBe("INSUFFICIENT_SHARES");
  });

  it("rejects sell trades on locked, settled, and void markets", async () => {
    const lockedBuy = await prisma.$transaction((tx) =>
      executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 30 })
    );
    await prisma.$transaction((tx) => lockDbMarket(tx, marketId("TOP_3"), userId, "Locked for test"));
    const locked = await postTrade(tradeRequest({ action: "SELL", marketId: marketId("TOP_3"), side: "YES", shares: toNumber(lockedBuy.shares) / 2 }));
    expect(locked.status).toBe(400);

    const settledBuy = await prisma.$transaction((tx) =>
      executeDbBuy(tx, { userId, marketId: marketId("TOP_5"), side: "YES", spend: 30 })
    );
    await prisma.$transaction((tx) => settleDbMarket(tx, { marketId: marketId("TOP_5"), result: "YES", settledById: userId }));
    const settled = await postTrade(tradeRequest({ action: "SELL", marketId: marketId("TOP_5"), side: "YES", shares: toNumber(settledBuy.shares) / 2 }));
    expect(settled.status).toBe(400);

    const voidBuy = await prisma.$transaction((tx) =>
      executeDbBuy(tx, { userId, marketId: marketId("TOP_10"), side: "NO", spend: 30 })
    );
    await prisma.$transaction((tx) => voidDbMarket(tx, marketId("TOP_10"), userId, "Void for test"));
    const voided = await postTrade(tradeRequest({ action: "SELL", marketId: marketId("TOP_10"), side: "NO", shares: toNumber(voidBuy.shares) / 2 }));
    expect(voided.status).toBe(400);
  });

  it("rejects sell trades without a valid CSRF token", async () => {
    await prisma.$transaction((tx) =>
      executeDbBuy(tx, { userId, marketId: marketId("TOP_3"), side: "YES", spend: 50 })
    );

    const missing = await postTrade(new Request("http://localhost/api/trades", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userSessionCookie },
      body: JSON.stringify({ action: "SELL", marketId: marketId("TOP_3"), side: "YES", shares: 1 })
    }));
    const invalid = await postTrade(new Request("http://localhost/api/trades", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userSessionCookie, "x-csrf-token": "bad-token" },
      body: JSON.stringify({ action: "SELL", marketId: marketId("TOP_3"), side: "YES", shares: 1 })
    }));

    expect(missing.status).toBe(403);
    expect(invalid.status).toBe(403);
  });

  it("returns the same trade for duplicate idempotency keys", async () => {
    const first = await postTrade(tradeRequest({ action: "BUY", marketId: marketId("TOP_10"), side: "YES", spend: 25, idempotencyKey: "duplicate_buy_key" }));
    const second = await postTrade(tradeRequest({ action: "BUY", marketId: marketId("TOP_10"), side: "YES", spend: 25, idempotencyKey: "duplicate_buy_key" }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const trades = await prisma.trade.findMany({ where: { idempotencyKey: "duplicate_buy_key" } });
    expect(trades).toHaveLength(1);
    expect(await getUserBalance(userId)).toBeCloseTo(975);
  });

  it("returns authenticated trade history with execution details", async () => {
    await prisma.$transaction((tx) =>
      executeDbBuy(tx, {
        userId,
        marketId: marketId("TOP_5"),
        side: "NO",
        spend: 55
      })
    );

    const response = await getTradeHistory(authenticatedRequest("http://localhost/api/trade-history"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { trades: Array<{ playerName: string; side: string; cost: number; marketPriceAfter: number }> };

    expect(payload.trades).toHaveLength(1);
    expect(payload.trades[0].playerName).toBe("Test Quarterback");
    expect(payload.trades[0].side).toBe("NO");
    expect(payload.trades[0].cost).toBeCloseTo(55);
    expect(payload.trades[0].marketPriceAfter).toBeGreaterThan(0);
  });

  it("settlement pays winning shares correctly and does not double-pay", async () => {
    const trade = await prisma.$transaction((tx) =>
      executeDbBuy(tx, {
        userId,
        marketId: marketId("TOP_3"),
        side: "YES",
        spend: 100
      })
    );

    await prisma.$transaction((tx) =>
      settleDbMarket(tx, {
        marketId: marketId("TOP_3"),
        result: "YES",
        positionalRank: 1
      })
    );

    const afterFirstSettlement = await getUserBalance(userId);
    const payoutEntriesAfterFirstSettlement = await prisma.accountLedgerEntry.findMany({
      where: {
        userId,
        marketId: marketId("TOP_3"),
        type: "SETTLEMENT_PAYOUT"
      }
    });
    const reconciliationAfterSettlement = await prisma.$transaction((tx) => reconcileUserLedger(tx, userId));

    expect(afterFirstSettlement).toBeCloseTo(900 + toNumber(trade.shares));
    expect(payoutEntriesAfterFirstSettlement).toHaveLength(1);
    expect(toNumber(payoutEntriesAfterFirstSettlement[0].amount)).toBeCloseTo(toNumber(trade.shares));
    expect(reconciliationAfterSettlement.isBalanced).toBe(true);

    await expect(
      prisma.$transaction((tx) =>
        settleDbMarket(tx, {
          marketId: marketId("TOP_3"),
          result: "YES",
          positionalRank: 1
        })
      )
    ).rejects.toThrow("Market is already settled");

    const payoutEntriesAfterDuplicateSettlement = await prisma.accountLedgerEntry.findMany({
      where: {
        userId,
        marketId: marketId("TOP_3"),
        type: "SETTLEMENT_PAYOUT"
      }
    });

    expect(await getUserBalance(userId)).toBeCloseTo(afterFirstSettlement);
    expect(payoutEntriesAfterDuplicateSettlement).toHaveLength(1);
  });

  it("calculates open and closed portfolio history values", async () => {
    await prisma.$transaction((tx) =>
      executeDbBuy(tx, {
        userId,
        marketId: marketId("TOP_3"),
        side: "YES",
        spend: 100
      })
    );
    await prisma.$transaction((tx) =>
      executeDbBuy(tx, {
        userId,
        marketId: marketId("TOP_10"),
        side: "NO",
        spend: 50
      })
    );
    await prisma.$transaction((tx) =>
      settleDbMarket(tx, {
        marketId: marketId("TOP_3"),
        result: "YES",
        positionalRank: 1,
        settledById: userId,
        reason: "Test settlement"
      })
    );

    const response = await getPortfolio(authenticatedRequest("http://localhost/api/portfolio"));
    const payload = (await response.json()) as { positions: Array<{ status: string; pnl: number; returnPct: number; currentValue: number }>; equityCurve: unknown[] };
    const closed = payload.positions.find((position) => position.status === "SETTLED");
    const open = payload.positions.find((position) => position.status === "OPEN");

    expect(closed).toBeTruthy();
    expect(open).toBeTruthy();
    expect(closed?.returnPct).not.toBeNaN();
    expect(open?.currentValue).toBeGreaterThan(0);
    expect(payload.equityCurve.length).toBeGreaterThanOrEqual(4);
  });

  it("void refunds cost basis correctly and does not double-refund", async () => {
    await prisma.$transaction((tx) =>
      executeDbBuy(tx, {
        userId,
        marketId: marketId("TOP_5"),
        side: "NO",
        spend: 75
      })
    );

    expect(await getUserBalance(userId)).toBeCloseTo(925);

    await prisma.$transaction((tx) => voidDbMarket(tx, marketId("TOP_5")));
    const refundEntriesAfterFirstVoid = await prisma.accountLedgerEntry.findMany({
      where: {
        userId,
        marketId: marketId("TOP_5"),
        type: "VOID_REFUND"
      }
    });
    const reconciliationAfterVoid = await prisma.$transaction((tx) => reconcileUserLedger(tx, userId));

    expect(await getUserBalance(userId)).toBeCloseTo(1000);
    expect(refundEntriesAfterFirstVoid).toHaveLength(1);
    expect(toNumber(refundEntriesAfterFirstVoid[0].amount)).toBeCloseTo(75);
    expect(reconciliationAfterVoid.isBalanced).toBe(true);

    await expect(prisma.$transaction((tx) => voidDbMarket(tx, marketId("TOP_5")))).rejects.toThrow("Market is already void");
    const refundEntriesAfterDuplicateVoid = await prisma.accountLedgerEntry.findMany({
      where: {
        userId,
        marketId: marketId("TOP_5"),
        type: "VOID_REFUND"
      }
    });

    expect(await getUserBalance(userId)).toBeCloseTo(1000);
    expect(refundEntriesAfterDuplicateVoid).toHaveLength(1);
  });

  it("records ordered market history events for trades and price changes", async () => {
    await prisma.$transaction((tx) =>
      executeDbBuy(tx, {
        userId,
        marketId: marketId("TOP_10"),
        side: "YES",
        spend: 40
      })
    );

    const events = await prisma.marketEvent.findMany({
      where: { marketId: marketId("TOP_10") },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    expect(events.map((event) => event.type)).toEqual(["TRADE", "PRICE_CHANGE"]);
    expect(toNumber(events[0].volume)).toBeCloseTo(40);
    expect(toNumber(events[1].priceAfter)).toBeGreaterThan(toNumber(events[1].priceBefore));
  });

  it("creates immutable-style admin audit records for lock and unlock actions", async () => {
    await prisma.$transaction((tx) => lockDbMarket(tx, marketId("TOP_5"), userId, "Kickoff lock"));
    await prisma.$transaction((tx) => openDbMarket(tx, marketId("TOP_5"), userId, "Admin correction"));

    const audits = await prisma.adminAuditLog.findMany({
      where: { marketId: marketId("TOP_5") },
      orderBy: { createdAt: "asc" }
    });

    expect(audits).toHaveLength(2);
    expect(audits[0].action).toBe("LOCK");
    expect(audits[0].reason).toBe("Kickoff lock");
    expect(audits[1].action).toBe("UNLOCK");
    expect(audits[1].previousState).toBe("LOCKED");
  });
});

function makeClientMarket(): Market {
  return {
    id: "client_market",
    playerId: "client_player",
    week: 1,
    position: "QB",
    threshold: "TOP_3",
    yesPool: 350,
    noPool: 150,
    liquidity: 500,
    status: "OPEN",
    result: null
  };
}

async function createBaseData() {
  await prisma.nflWeek.create({
    data: {
      id: weekId,
      season: 2099,
      week: 1,
      startsAt: new Date("2099-09-01T00:00:00.000Z"),
      endsAt: new Date("2099-09-08T00:00:00.000Z"),
      status: "OPEN"
    }
  });

  await prisma.game.create({
    data: {
      id: gameId,
      weekId,
      homeTeam: "TST",
      awayTeam: "DBG",
      kickoffTime: new Date("2099-09-03T17:00:00.000Z")
    }
  });

  await prisma.player.create({
    data: {
      id: playerId,
      name: "Test Quarterback",
      team: "TST",
      position: "QB"
    }
  });

  await prisma.user.create({
    data: {
      id: userId,
      name: "Test User",
      firstName: "Test",
      lastName: "User",
      displayName: "Test User",
      email: "money.user@fantasyx.test",
      passwordHash: "test-password-hash",
      role: "ADMIN",
      mockBalance: 1000,
      startingBalance: 1000,
      isAdmin: true
    }
  });

  await prisma.user.create({
    data: {
      id: otherUserId,
      name: "Other Test User",
      firstName: "Other",
      lastName: "Test User",
      displayName: "Other Test User",
      email: "money.other@fantasyx.test",
      passwordHash: "test-password-hash",
      mockBalance: 1000,
      startingBalance: 1000
    }
  });

  await prisma.accountLedgerEntry.createMany({
    data: [
      {
        userId,
        type: "SEED_GRANT",
        amount: 1000,
        balanceAfter: 1000,
        idempotencyKey: `test_seed_grant:${userId}`,
        reason: "Test seed grant",
        metadata: { test: true }
      },
      {
        userId: otherUserId,
        type: "SEED_GRANT",
        amount: 1000,
        balanceAfter: 1000,
        idempotencyKey: `test_seed_grant:${otherUserId}`,
        reason: "Test seed grant",
        metadata: { test: true }
      }
    ]
  });

  await prisma.market.createMany({
    data: [
      makeDbMarket("TOP_3"),
      makeDbMarket("TOP_5"),
      makeDbMarket("TOP_10")
    ]
  });

  userSessionCookie = `${sessionCookieName}=${await createSession(userId)}`;
}

function makeDbMarket(thresholdType: "TOP_3" | "TOP_5" | "TOP_10") {
  const yesPrice = thresholdType === "TOP_3" ? 0.3 : thresholdType === "TOP_5" ? 0.45 : 0.6;
  return {
    id: marketId(thresholdType),
    playerId,
    weekId,
    gameId,
    position: "QB" as const,
    thresholdType,
    yesPrice,
    noPrice: 1 - yesPrice,
    openingPrice: yesPrice,
    yesPool: 500 * (1 - yesPrice),
    noPool: 500 * yesPrice,
    volume: 0,
    openInterest: 0,
    status: "OPEN" as const,
    kickoffTime: new Date("2099-09-03T17:00:00.000Z")
  };
}

async function resetTestData() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL fantasyx.allow_ledger_mutation = 'on'");
    await tx.accountLedgerEntry.deleteMany({ where: { marketId: { startsWith: "test_market_money_market" } } });
    await tx.accountLedgerEntry.deleteMany({ where: { OR: [{ userId }, { userId: otherUserId }] } });
  });
  await prisma.marketEvent.deleteMany({ where: { marketId: { startsWith: "test_market_money_market" } } });
  await prisma.adminAuditLog.deleteMany({ where: { OR: [{ marketId: { startsWith: "test_market_money_market" } }, { actorId: userId }] } });
  await prisma.settlement.deleteMany({ where: { marketId: { startsWith: "test_market_money_market" } } });
  await prisma.trade.deleteMany({ where: { marketId: { startsWith: "test_market_money_market" } } });
  await prisma.position.deleteMany({ where: { marketId: { startsWith: "test_market_money_market" } } });
  await prisma.leaderboardEntry.deleteMany({ where: { OR: [{ weekId }, { userId }, { userId: otherUserId }] } });
  await prisma.market.deleteMany({ where: { id: { startsWith: "test_market_money_market" } } });
  await prisma.player.deleteMany({ where: { id: playerId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.nflWeek.deleteMany({ where: { id: weekId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.user.deleteMany({ where: { id: otherUserId } });
}

async function getUserBalance(targetUserId = userId) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  return toNumber(user.mockBalance);
}

function marketId(thresholdType: "TOP_3" | "TOP_5" | "TOP_10") {
  return `test_market_money_market_${thresholdType.toLowerCase()}`;
}

function authenticatedRequest(url: string) {
  return new Request(url, {
    headers: {
      cookie: userSessionCookie
    }
  });
}

function tradeRequest(body: unknown) {
  return new Request("http://localhost/api/trades", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...csrfHeaders(userSessionCookie)
    },
    body: JSON.stringify(body)
  });
}

function csrfHeaders(cookie: string) {
  const request = new Request("http://localhost", { headers: { cookie } });
  return { cookie, "x-csrf-token": csrfTokenForRequest(request) ?? "" };
}
