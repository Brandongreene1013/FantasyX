-- FX-014: Watchlist and onboarding fields

-- Add onboarding fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "favorite_team" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_done" BOOLEAN NOT NULL DEFAULT false;

-- Create watch_markets table
CREATE TABLE IF NOT EXISTS "watch_markets" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "market_id"  TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watch_markets_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "watch_markets_user_id_market_id_key" ON "watch_markets"("user_id", "market_id");
CREATE INDEX IF NOT EXISTS "watch_markets_user_id_idx" ON "watch_markets"("user_id");

-- Foreign keys
ALTER TABLE "watch_markets" ADD CONSTRAINT "watch_markets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watch_markets" ADD CONSTRAINT "watch_markets_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
