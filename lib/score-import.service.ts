import { prisma } from "@/lib/prisma";
import { calculateHalfPpr, rankPlayers } from "@/lib/scoring.service";
import type { RawStats } from "@/lib/scoring.service";

const REQUIRED_COLS = ["position", "pass_yards", "pass_tds", "interceptions", "rush_yards", "rush_tds", "receptions", "rec_yards", "rec_tds", "fumbles", "two_point_conv"] as const;

export interface CsvRow {
  rowIndex: number;
  raw: Record<string, string>;
}

export interface ParsedRow {
  rowIndex: number;
  playerIdentifier: string;
  position: string;
  stats: RawStats;
}

export interface ValidationResult {
  valid: ParsedRow[];
  errors: Array<{ row: number; message: string }>;
}

function parseNum(val: string | undefined): number {
  const n = parseInt(val ?? "0", 10);
  return isNaN(n) ? 0 : n;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = values[idx] ?? ""; });
    rows.push({ rowIndex: i, raw });
  }

  return rows;
}

export function validateCsvText(text: string): ValidationResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { valid: [], errors: [{ row: 0, message: "CSV is empty or has no data rows" }] };
  }

  const headers = Object.keys(rows[0].raw);
  const hasPlayerId = headers.includes("player_id");
  const hasPlayerName = headers.includes("player_name");

  if (!hasPlayerId && !hasPlayerName) {
    return {
      valid: [],
      errors: [{ row: 0, message: "CSV must have either a 'player_id' or 'player_name' column" }]
    };
  }

  const missingCols = REQUIRED_COLS.filter((c) => !headers.includes(c));
  if (missingCols.length > 0) {
    return {
      valid: [],
      errors: [{ row: 0, message: `CSV is missing required columns: ${missingCols.join(", ")}` }]
    };
  }

  const valid: ParsedRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  const seenIdentifiers = new Set<string>();

  for (const row of rows) {
    const identifier = row.raw["player_id"] || row.raw["player_name"] || "";
    if (!identifier) {
      errors.push({ row: row.rowIndex, message: "Missing player_id or player_name" });
      continue;
    }

    const position = (row.raw["position"] ?? "").toUpperCase();
    if (!["QB", "RB", "WR", "TE"].includes(position)) {
      errors.push({ row: row.rowIndex, message: `Invalid position '${position}' for ${identifier}` });
      continue;
    }

    const dupKey = `${identifier}`;
    if (seenIdentifiers.has(dupKey)) {
      errors.push({ row: row.rowIndex, message: `Duplicate entry for ${identifier}` });
      continue;
    }
    seenIdentifiers.add(dupKey);

    valid.push({
      rowIndex: row.rowIndex,
      playerIdentifier: identifier,
      position,
      stats: {
        passYards:     parseNum(row.raw["pass_yards"]),
        passTDs:       parseNum(row.raw["pass_tds"]),
        interceptions: parseNum(row.raw["interceptions"]),
        rushYards:     parseNum(row.raw["rush_yards"]),
        rushTDs:       parseNum(row.raw["rush_tds"]),
        receptions:    parseNum(row.raw["receptions"]),
        recYards:      parseNum(row.raw["rec_yards"]),
        recTDs:        parseNum(row.raw["rec_tds"]),
        fumbles:       parseNum(row.raw["fumbles"]),
        twoPointConv:  parseNum(row.raw["two_point_conv"])
      }
    });
  }

  return { valid, errors };
}

export interface ImportResult {
  importId: string;
  weekId: string;
  rowCount: number;
  importedCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
  unknownPlayers: string[];
}

export async function importScoresFromCsv(input: {
  weekId: string;
  adminId: string;
  filename: string;
  csvText: string;
}): Promise<ImportResult> {
  const { valid, errors } = validateCsvText(input.csvText);

  // Create the import record upfront
  const scoreImport = await prisma.scoreImport.create({
    data: {
      weekId: input.weekId,
      adminId: input.adminId,
      filename: input.filename,
      status: "PENDING",
      rowCount: valid.length + errors.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    }
  });

  if (valid.length === 0) {
    await prisma.scoreImport.update({
      where: { id: scoreImport.id },
      data: { status: "FAILED" }
    });
    return {
      importId: scoreImport.id,
      weekId: input.weekId,
      rowCount: errors.length,
      importedCount: 0,
      errorCount: errors.length,
      errors,
      unknownPlayers: []
    };
  }

  // Resolve player identifiers to DB IDs
  const allPlayers = await prisma.player.findMany({ select: { id: true, name: true, team: true } });
  const playerById = new Map(allPlayers.map((p) => [p.id, p]));
  const playerByName = new Map(allPlayers.map((p) => [p.name.toLowerCase(), p]));

  const resolved: Array<{ dbPlayerId: string; position: string; stats: RawStats }> = [];
  const unknownPlayers: string[] = [];
  const importErrors = [...errors];

  for (const row of valid) {
    const byId = playerById.get(row.playerIdentifier);
    const byName = byId ?? playerByName.get(row.playerIdentifier.toLowerCase());
    if (!byName) {
      unknownPlayers.push(row.playerIdentifier);
      importErrors.push({ row: row.rowIndex, message: `Unknown player: ${row.playerIdentifier}` });
      continue;
    }
    resolved.push({ dbPlayerId: byName.id, position: row.position, stats: row.stats });
  }

  if (resolved.length === 0) {
    await prisma.scoreImport.update({
      where: { id: scoreImport.id },
      data: { status: "FAILED", errorCount: importErrors.length, errors: importErrors }
    });
    return {
      importId: scoreImport.id,
      weekId: input.weekId,
      rowCount: valid.length + errors.length,
      importedCount: 0,
      errorCount: importErrors.length,
      errors: importErrors,
      unknownPlayers
    };
  }

  // Calculate fantasy points and ranks
  const scored = rankPlayers(resolved.map((r) => ({ playerId: r.dbPlayerId, position: r.position, stats: r.stats })));

  // Upsert scores (delete existing from prior imports for this week, then create new)
  await prisma.$transaction(async (tx) => {
    // Delete any existing player scores for these players in this week
    await tx.playerScore.deleteMany({
      where: {
        weekId: input.weekId,
        playerId: { in: scored.map((s) => s.playerId) }
      }
    });

    for (const s of scored) {
      const stats = resolved.find((r) => r.dbPlayerId === s.playerId)!.stats;
      await tx.playerScore.create({
        data: {
          importId: scoreImport.id,
          playerId: s.playerId,
          weekId: input.weekId,
          fantasyPoints: s.fantasyPoints,
          positionalRank: s.positionalRank,
          overallRank: s.overallRank,
          passYards:     stats.passYards,
          passTDs:       stats.passTDs,
          interceptions: stats.interceptions,
          rushYards:     stats.rushYards,
          rushTDs:       stats.rushTDs,
          receptions:    stats.receptions,
          recYards:      stats.recYards,
          recTDs:        stats.recTDs,
          fumbles:       stats.fumbles,
          twoPointConv:  stats.twoPointConv
        }
      });
    }

    await tx.scoreImport.update({
      where: { id: scoreImport.id },
      data: {
        status: importErrors.length > 0 ? "VALIDATED" : "IMPORTED",
        rowCount: valid.length + errors.length,
        errorCount: importErrors.length,
        errors: importErrors.length > 0 ? importErrors : undefined
      }
    });
  });

  return {
    importId: scoreImport.id,
    weekId: input.weekId,
    rowCount: valid.length + errors.length,
    importedCount: scored.length,
    errorCount: importErrors.length,
    errors: importErrors,
    unknownPlayers
  };
}

export async function listScoreImports(weekId: string) {
  return prisma.scoreImport.findMany({
    where: { weekId },
    orderBy: { createdAt: "desc" },
    include: {
      admin: { select: { displayName: true, email: true } },
      scores: { select: { id: true } }
    }
  });
}

export async function getLatestScoresForWeek(weekId: string) {
  // Return the most recent score per player (by querying player_scores directly for this week)
  return prisma.playerScore.findMany({
    where: { weekId },
    orderBy: { createdAt: "desc" },
    include: {
      player: { select: { id: true, name: true, team: true, position: true } }
    }
  });
}
