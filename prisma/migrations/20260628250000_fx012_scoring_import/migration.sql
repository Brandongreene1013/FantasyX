-- FX-012: Live NFL Data, Automated Scoring & Settlement

-- Import status enum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'VALIDATED', 'IMPORTED', 'FAILED');

-- Score import table (stores metadata for each admin CSV upload)
CREATE TABLE "score_imports" (
    "id"          TEXT NOT NULL,
    "week_id"     TEXT NOT NULL,
    "admin_id"    TEXT NOT NULL,
    "filename"    TEXT NOT NULL,
    "status"      "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "row_count"   INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "errors"      JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_imports_pkey" PRIMARY KEY ("id")
);

-- Player score table (one row per player per week, per import)
CREATE TABLE "player_scores" (
    "id"              TEXT NOT NULL,
    "import_id"       TEXT NOT NULL,
    "player_id"       TEXT NOT NULL,
    "week_id"         TEXT NOT NULL,
    "fantasy_points"  DECIMAL(8,2) NOT NULL DEFAULT 0,
    "positional_rank" INTEGER NOT NULL DEFAULT 0,
    "overall_rank"    INTEGER,
    "pass_yards"      INTEGER NOT NULL DEFAULT 0,
    "pass_tds"        INTEGER NOT NULL DEFAULT 0,
    "interceptions"   INTEGER NOT NULL DEFAULT 0,
    "rush_yards"      INTEGER NOT NULL DEFAULT 0,
    "rush_tds"        INTEGER NOT NULL DEFAULT 0,
    "receptions"      INTEGER NOT NULL DEFAULT 0,
    "rec_yards"       INTEGER NOT NULL DEFAULT 0,
    "rec_tds"         INTEGER NOT NULL DEFAULT 0,
    "fumbles"         INTEGER NOT NULL DEFAULT 0,
    "two_point_conv"  INTEGER NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_scores_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "score_imports_week_id_idx"    ON "score_imports"("week_id");
CREATE INDEX "score_imports_admin_id_idx"   ON "score_imports"("admin_id");
CREATE INDEX "player_scores_import_id_idx"  ON "player_scores"("import_id");
CREATE INDEX "player_scores_week_id_idx"    ON "player_scores"("week_id");
CREATE INDEX "player_scores_player_id_idx"  ON "player_scores"("player_id");

-- Unique: one active score per player per week (enforced at application layer, not DB, to allow re-imports)

-- Foreign keys
ALTER TABLE "score_imports" ADD CONSTRAINT "score_imports_week_id_fkey"  FOREIGN KEY ("week_id")  REFERENCES "nfl_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "score_imports" ADD CONSTRAINT "score_imports_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "player_scores" ADD CONSTRAINT "player_scores_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "score_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_scores" ADD CONSTRAINT "player_scores_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id")      ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "player_scores" ADD CONSTRAINT "player_scores_week_id_fkey"   FOREIGN KEY ("week_id")   REFERENCES "nfl_weeks"("id")     ON DELETE CASCADE  ON UPDATE CASCADE;

-- New admin audit actions
ALTER TYPE "AdminAuditAction" ADD VALUE 'SCORE_IMPORT';
ALTER TYPE "AdminAuditAction" ADD VALUE 'SETTLEMENT_BATCH';
ALTER TYPE "AdminAuditAction" ADD VALUE 'KICKOFF_LOCK';
