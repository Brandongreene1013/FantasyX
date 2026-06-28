import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/db-serialization";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { calculatePortfolioAnalytics } from "@/lib/market-analytics.service";

export async function GET(request: Request) {
  try {
    const sessionUser = await requireSessionUser(request);

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        positions: {
          include: {
            market: {
              include: {
                player: true,
                game: true
              }
            }
          },
          orderBy: { updatedAt: "desc" }
        },
        trades: {
          include: {
            market: {
              include: {
                player: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 25
        },
        ledgerEntries: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const positions = user.positions.map((position) => {
      const market = position.market;
      const yesShares = toNumber(position.yesShares);
      const noShares = toNumber(position.noShares);
      const yesPrice = toNumber(market.yesPrice);
      const noPrice = toNumber(market.noPrice);
      const isClosed = market.status === "SETTLED" || market.status === "VOID";
      const value =
        isClosed
          ? 0
          : yesShares * yesPrice + noShares * noPrice;
      const totalShares = yesShares + noShares;
      const costBasis = toNumber(position.costBasis);
      const realizedPayout = toNumber(position.realizedPayout);
      const pnl = isClosed ? realizedPayout - costBasis : value - costBasis;

      return {
        id: position.id,
        marketId: position.marketId,
        playerId: market.playerId,
        playerName: market.player.name,
        team: market.player.team,
        position: market.position,
        thresholdType: market.thresholdType,
        status: market.status,
        result: market.result,
        yesShares,
        noShares,
        costBasis,
        realizedPayout,
        averageEntry: totalShares > 0 ? costBasis / totalShares : 0,
        entryPrice: totalShares > 0 ? costBasis / totalShares : 0,
        currentPrice: totalShares > 0 ? value / totalShares : 0,
        currentValue: value,
        value,
        pnl,
        returnPct: costBasis > 0 ? pnl / costBasis : 0
      };
    });

    const openValue = positions.reduce((total, position) => total + (position.status === "OPEN" || position.status === "LOCKED" ? position.value : 0), 0);
    const equity = toNumber(user.mockBalance) + openValue;
    const pnl = equity - toNumber(user.startingBalance);
    const trades = user.trades.map((trade) => ({
      id: trade.id,
      marketId: trade.marketId,
      playerName: trade.market.player.name,
      side: trade.side,
      spend: toNumber(trade.spend),
      shares: toNumber(trade.shares),
      priceBefore: toNumber(trade.priceBefore),
      priceAfter: toNumber(trade.priceAfter),
      createdAt: trade.createdAt.toISOString()
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        isAdmin: user.isAdmin,
        mockBalance: toNumber(user.mockBalance),
        startingBalance: toNumber(user.startingBalance),
        equity,
        pnl
      },
      positions,
      analytics: calculatePortfolioAnalytics({
        startingBalance: toNumber(user.startingBalance),
        mockBalance: toNumber(user.mockBalance),
        openValue,
        positions,
        trades
      }),
      equityCurve: user.ledgerEntries.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        balance: toNumber(entry.balanceAfter),
        amount: toNumber(entry.amount),
        type: entry.type
      })),
      trades
    });
  } catch (error) {
    return apiError(error, "Could not load portfolio");
  }
}
