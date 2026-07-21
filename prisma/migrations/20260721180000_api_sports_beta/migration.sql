CREATE TABLE "live_player_scores" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fantasy_points" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "pass_yards" INTEGER NOT NULL DEFAULT 0,
    "pass_tds" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "rush_yards" INTEGER NOT NULL DEFAULT 0,
    "rush_tds" INTEGER NOT NULL DEFAULT 0,
    "receptions" INTEGER NOT NULL DEFAULT 0,
    "rec_yards" INTEGER NOT NULL DEFAULT 0,
    "rec_tds" INTEGER NOT NULL DEFAULT 0,
    "fumbles" INTEGER NOT NULL DEFAULT 0,
    "two_point_conv" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_player_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "live_player_scores_player_id_week_id_key" ON "live_player_scores"("player_id", "week_id");
CREATE INDEX "live_player_scores_week_id_fantasy_points_idx" ON "live_player_scores"("week_id", "fantasy_points");
CREATE INDEX "live_player_scores_game_id_idx" ON "live_player_scores"("game_id");

ALTER TABLE "live_player_scores" ADD CONSTRAINT "live_player_scores_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_player_scores" ADD CONSTRAINT "live_player_scores_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "nfl_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_player_scores" ADD CONSTRAINT "live_player_scores_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
