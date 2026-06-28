import { prisma } from "@/lib/prisma";
import type { AdminAuditAction } from "@prisma/client";

export type CreateWeekInput = {
  season: number;
  week: number;
  startsAt: Date;
  endsAt: Date;
  adminId: string;
};

export type WeekWithCounts = {
  id: string;
  season: number;
  week: number;
  startsAt: Date;
  endsAt: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  marketCount: number;
  playerCount: number;
  openMarkets: number;
  lockedMarkets: number;
  settledMarkets: number;
  draftMarkets: number;
};

export async function createWeek(input: CreateWeekInput): Promise<WeekWithCounts> {
  const weekId = `nfl_${input.season}_w${input.week}`;

  const existing = await prisma.nflWeek.findUnique({ where: { id: weekId } });
  if (existing) throw new Error(`Week nfl_${input.season}_w${input.week} already exists`);

  const week = await prisma.nflWeek.create({
    data: {
      id: weekId,
      season: input.season,
      week: input.week,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "SCHEDULED"
    }
  });

  await prisma.adminAuditLog.create({
    data: {
      actorId: input.adminId,
      action: "WEEK_CREATE" as AdminAuditAction,
      weekId,
      nextState: "SCHEDULED",
      reason: `Week ${input.season} W${input.week} created by admin`
    }
  });

  return weekWithCounts(week, []);
}

export async function updateWeekStatus(
  weekId: string,
  newStatus: "SCHEDULED" | "ACTIVE" | "COMPLETE" | "ARCHIVED",
  adminId: string,
  reason?: string
): Promise<WeekWithCounts> {
  const week = await prisma.nflWeek.findUnique({ where: { id: weekId } });
  if (!week) throw new Error(`Week not found: ${weekId}`);

  const prevStatus = week.status;
  const updated = await prisma.nflWeek.update({
    where: { id: weekId },
    data: { status: newStatus }
  });

  const auditAction: AdminAuditAction =
    newStatus === "ACTIVE" ? ("WEEK_ACTIVATE" as AdminAuditAction) :
    newStatus === "SCHEDULED" ? ("WEEK_DEACTIVATE" as AdminAuditAction) :
    ("WEEK_ARCHIVE" as AdminAuditAction);

  await prisma.adminAuditLog.create({
    data: {
      actorId: adminId,
      action: auditAction as AdminAuditAction,
      weekId,
      previousState: prevStatus,
      nextState: newStatus,
      reason: reason ?? `Week status changed to ${newStatus}`
    }
  });

  const markets = await prisma.market.findMany({ where: { weekId } });
  return weekWithCounts(updated, markets);
}

export async function listWeeksWithCounts(): Promise<WeekWithCounts[]> {
  const weeks = await prisma.nflWeek.findMany({
    include: { markets: { select: { status: true, playerId: true } } },
    orderBy: [{ season: "desc" }, { week: "desc" }]
  });

  return weeks.map((w) => weekWithCounts(w, w.markets));
}

export async function getWeekWithCounts(weekId: string): Promise<WeekWithCounts | null> {
  const week = await prisma.nflWeek.findUnique({
    where: { id: weekId },
    include: { markets: { select: { status: true, playerId: true } } }
  });
  if (!week) return null;
  return weekWithCounts(week, week.markets);
}

function weekWithCounts(
  week: { id: string; season: number; week: number; startsAt: Date; endsAt: Date; status: string; createdAt: Date; updatedAt: Date },
  markets: Array<{ status: string; playerId: string }>
): WeekWithCounts {
  const playerIds = new Set(markets.map((m) => m.playerId));
  return {
    ...week,
    marketCount: markets.length,
    playerCount: playerIds.size,
    openMarkets:    markets.filter((m) => m.status === "OPEN").length,
    lockedMarkets:  markets.filter((m) => m.status === "LOCKED").length,
    settledMarkets: markets.filter((m) => m.status === "SETTLED").length,
    draftMarkets:   markets.filter((m) => m.status === "DRAFT" || m.status === "SCHEDULED").length
  };
}
