import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-response";
import { AuthError, getSessionUser } from "@/lib/auth";
import {
  discoveryMarketTypes,
  discoveryPositions,
  discoveryStatuses,
  marketDiscoveryQuerySchema,
  paginateDiscoveryMarkets,
  serializeDiscoveryMarket,
  sortDiscoveryMarkets
} from "@/lib/market-discovery";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const parsed = marketDiscoveryQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const user = await getSessionUser(request);

    if (parsed.watchlistOnly && !user) {
      throw new AuthError("Authentication required for watchlist markets", 401);
    }

    const where: Prisma.MarketWhereInput = {
      weekId: parsed.weekId,
      ...(parsed.position ? { position: parsed.position } : {}),
      ...(parsed.marketType ? { thresholdType: parsed.marketType } : {}),
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.team ? { player: { team: parsed.team } } : {}),
      ...(parsed.watchlistOnly && user ? { watchedBy: { some: { userId: user.id } } } : {})
    };

    if (parsed.q) {
      const normalizedQuery = parsed.q.toUpperCase().replace(/\s+/g, "_");
      const searchClauses: Prisma.MarketWhereInput[] = [
        { player: { name: { contains: parsed.q, mode: "insensitive" } } },
        { player: { team: { contains: parsed.q, mode: "insensitive" } } }
      ];

      if (discoveryPositions.some((position) => position === normalizedQuery)) {
        searchClauses.push({ position: normalizedQuery as typeof discoveryPositions[number] });
      }
      if (discoveryMarketTypes.some((type) => type === normalizedQuery)) {
        searchClauses.push({ thresholdType: normalizedQuery as typeof discoveryMarketTypes[number] });
      }

      where.OR = [
        ...searchClauses
      ];
    }

    const rawMarkets = await prisma.market.findMany({
      where,
      include: {
        player: true,
        _count: {
          select: {
            trades: true,
            watchedBy: true
          }
        },
        ...(user
          ? {
              watchedBy: {
                where: { userId: user.id },
                select: { userId: true }
              }
            }
          : {})
      },
      orderBy: [
        { volume: "desc" },
        { openInterest: "desc" },
        { yesPrice: "desc" },
        { player: { name: "asc" } }
      ],
      take: 500
    });

    const allFilterMarkets = await prisma.market.findMany({
      where: { weekId: parsed.weekId },
      select: {
        position: true,
        thresholdType: true,
        status: true,
        player: {
          select: { team: true }
        }
      }
    });

    const sorted = sortDiscoveryMarkets(rawMarkets.map(serializeDiscoveryMarket), parsed.sort);
    const page = paginateDiscoveryMarkets(sorted, parsed);

    return NextResponse.json({
      weekId: parsed.weekId,
      query: parsed,
      markets: page.markets,
      filters: {
        positions: discoveryPositions.filter((position) => allFilterMarkets.some((market) => market.position === position)),
        teams: Array.from(new Set(allFilterMarkets.map((market) => market.player.team))).sort(),
        marketTypes: discoveryMarketTypes.filter((type) => allFilterMarkets.some((market) => market.thresholdType === type)),
        statuses: discoveryStatuses.filter((status) => allFilterMarkets.some((market) => market.status === status))
      },
      pagination: page.pagination,
      meta: {
        metrics: {
          price: "real",
          change: "current yes price minus opening yes price",
          volume: "real persisted market volume",
          liquidity: "yes pool plus no pool",
          popularity: "deterministic ranking from volume, open interest, trades, watches, and liquidity"
        }
      }
    });
  } catch (error) {
    return apiError(error, "Could not load market discovery", undefined, request);
  }
}
