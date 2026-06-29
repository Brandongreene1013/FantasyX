export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { serializeMarket, serializePlayerFromMarket, toNumber } from "@/lib/db-serialization";

const DEFAULT_WEEK = "nfl_2026_w1";

function sseChunk(encoder: TextEncoder, event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function fetchSlate(weekId: string) {
  const markets = await prisma.market.findMany({
    where: { weekId },
    include: { player: true, game: true },
    orderBy: [{ position: "asc" }, { kickoffTime: "asc" }]
  });
  const players = new Map(
    markets.map(serializePlayerFromMarket).filter(Boolean).map((p) => [p!.id, p!])
  );
  return { weekId, players: Array.from(players.values()), markets: markets.map(serializeMarket) };
}

async function fetchFeed(weekId: string) {
  const events = await prisma.marketEvent.findMany({
    where: { type: "TRADE", market: { weekId } },
    include: {
      user: { select: { firstName: true, lastName: true, displayName: true } },
      trade: { select: { action: true, side: true, spend: true } },
      market: { include: { player: { select: { name: true } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return {
    events: events.map((e) => {
      const dn = e.user?.displayName;
      const fn = e.user?.firstName ?? "";
      const ln = e.user?.lastName ?? "";
      const actorName = dn && dn.trim()
        ? dn
        : fn
          ? `${fn} ${ln ? ln[0] + "." : ""}`.trim()
          : "Trader";
      return {
        id: e.id,
        actorName,
        action: e.trade?.action ?? "BUY",
        side: e.trade?.side ?? "YES",
        spend: e.trade?.spend ? toNumber(e.trade.spend) : 0,
        playerName: e.market.player.name,
        position: e.market.position,
        threshold: e.market.thresholdType,
        marketId: e.marketId,
        priceAfter: e.priceAfter ? toNumber(e.priceAfter) : 0,
        createdAt: e.createdAt.toISOString()
      };
    })
  };
}

async function fetchLeaderboard(weekId: string) {
  const entries = await prisma.leaderboardEntry.findMany({
    where: { weekId },
    include: { user: { select: { id: true, displayName: true, firstName: true, lastName: true, mockBalance: true } } },
    orderBy: [{ rank: "asc" }, { pnl: "desc" }],
    take: 25
  });
  return {
    weekId,
    entries: entries.map((e, i) => ({
      id: e.id,
      userId: e.userId,
      name: e.user.displayName || `${e.user.firstName} ${e.user.lastName}`.trim() || "Trader",
      weeklyPnl: toNumber(e.pnl),
      totalPnl: toNumber(e.pnl),
      balance: toNumber(e.user.mockBalance),
      rank: e.rank ?? i + 1
    }))
  };
}

async function fetchStatus(weekId: string) {
  const [marketCounts, volAgg, activeTraders] = await Promise.all([
    prisma.market.groupBy({
      by: ["status"],
      where: { weekId },
      _count: { status: true }
    }),
    prisma.market.aggregate({
      where: { weekId, status: "OPEN" },
      _sum: { volume: true }
    }),
    prisma.trade.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
      distinct: ["userId"],
      select: { userId: true }
    })
  ]);

  const counts: Record<string, number> = {};
  for (const g of marketCounts) counts[g.status] = g._count.status;

  return {
    weekId,
    weekLabel: "Week 1",
    isLive: (counts["OPEN"] ?? 0) > 0,
    openMarkets: counts["OPEN"] ?? 0,
    lockedMarkets: counts["LOCKED"] ?? 0,
    settledMarkets: counts["SETTLED"] ?? 0,
    awaitingSettlement: counts["LOCKED"] ?? 0,
    totalVolume: toNumber(volAgg._sum.volume ?? 0),
    activeTraders: activeTraders.length
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const weekId = url.searchParams.get("weekId") ?? DEFAULT_WEEK;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      function enqueue(event: string, data: unknown) {
        if (closed) return;
        try { controller.enqueue(sseChunk(encoder, event, data)); }
        catch { closed = true; }
      }

      async function pushAll() {
        try {
          const [slate, feed, lb, status] = await Promise.all([
            fetchSlate(weekId),
            fetchFeed(weekId),
            fetchLeaderboard(weekId),
            fetchStatus(weekId)
          ]);
          enqueue("slate", slate);
          enqueue("feed", feed);
          enqueue("leaderboard", lb);
          enqueue("status", status);
        } catch { /* ignore DB errors mid-stream */ }
      }

      // Initial push
      await pushAll();
      enqueue("heartbeat", { ts: Date.now() });

      // Poll at 10s intervals
      const pollInterval = setInterval(() => void pushAll(), 10000);
      const heartbeatInterval = setInterval(() => enqueue("heartbeat", { ts: Date.now() }), 25000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed */ }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
