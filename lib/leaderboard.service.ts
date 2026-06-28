import type { Prisma } from "@prisma/client";
import { toNumber } from "@/lib/db-serialization";

export async function refreshLeaderboardForWeek(tx: Prisma.TransactionClient, weekId: string) {
  const usersWithPositions = await tx.user.findMany({
    where: {
      positions: {
        some: { market: { weekId } }
      }
    },
    include: {
      positions: {
        include: { market: true }
      }
    }
  });

  const rows = usersWithPositions
    .map((user) => {
      const markedValue = user.positions.reduce((total, position) => {
        const market = position.market;
        if (market.status === "SETTLED" || market.status === "VOID") {
          return total;
        }
        return total + toNumber(position.yesShares) * toNumber(market.yesPrice) + toNumber(position.noShares) * toNumber(market.noPrice);
      }, 0);
      const pnl = toNumber(user.mockBalance) + markedValue - toNumber(user.startingBalance);
      return { user, pnl };
    })
    .sort((a, b) => b.pnl - a.pnl);

  for (const [index, row] of rows.entries()) {
    await tx.leaderboardEntry.upsert({
      where: {
        userId_weekId: { userId: row.user.id, weekId }
      },
      create: {
        userId: row.user.id,
        weekId,
        pnl: row.pnl,
        rank: index + 1
      },
      update: {
        pnl: row.pnl,
        rank: index + 1
      }
    });
  }
}
