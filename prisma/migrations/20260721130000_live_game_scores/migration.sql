ALTER TABLE "games"
  ADD COLUMN "provider_status" TEXT,
  ADD COLUMN "home_score" INTEGER,
  ADD COLUMN "away_score" INTEGER,
  ADD COLUMN "period" TEXT,
  ADD COLUMN "game_clock" TEXT,
  ADD COLUMN "possession" TEXT,
  ADD COLUMN "score_provider" TEXT,
  ADD COLUMN "score_updated_at" TIMESTAMP(3);
