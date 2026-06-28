-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlayerPosition" AS ENUM ('QB', 'RB', 'WR', 'TE');

-- CreateEnum
CREATE TYPE "ThresholdType" AS ENUM ('TOP_3', 'TOP_5', 'TOP_10');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'VOID');

-- CreateEnum
CREATE TYPE "MarketResult" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('SEED_GRANT', 'TRADE_SPEND', 'SETTLEMENT_PAYOUT', 'VOID_REFUND', 'ADMIN_ADJUSTMENT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "MarketEventType" AS ENUM ('TRADE', 'PRICE_CHANGE', 'LOCK', 'UNLOCK', 'SETTLE', 'VOID', 'ADMIN_NOTE');

-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('SETTLEMENT', 'VOID', 'LOCK', 'UNLOCK', 'MARKET_EDIT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "wallet_address" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "mock_balance" DECIMAL(14,2) NOT NULL DEFAULT 1000,
    "starting_balance" DECIMAL(14,2) NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "position" "PlayerPosition" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfl_weeks" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfl_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "kickoff_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "game_id" TEXT,
    "position" "PlayerPosition" NOT NULL,
    "threshold_type" "ThresholdType" NOT NULL,
    "yes_price" DECIMAL(8,6) NOT NULL,
    "no_price" DECIMAL(8,6) NOT NULL,
    "opening_price" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "yes_pool" DECIMAL(14,6) NOT NULL,
    "no_pool" DECIMAL(14,6) NOT NULL,
    "volume" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "open_interest" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
    "result" "MarketResult",
    "kickoff_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "spend" DECIMAL(14,2) NOT NULL,
    "shares" DECIMAL(14,6) NOT NULL,
    "price_before" DECIMAL(8,6) NOT NULL,
    "price_after" DECIMAL(8,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "yes_shares" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "no_shares" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "cost_basis" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "realized_payout" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "settled_by_id" TEXT,
    "result" "MarketResult" NOT NULL,
    "fantasy_points" DECIMAL(8,2),
    "positional_rank" INTEGER,
    "scoring_format" TEXT NOT NULL DEFAULT 'HALF_PPR',
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_ledger_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "trade_id" TEXT,
    "settlement_id" TEXT,
    "market_id" TEXT,
    "admin_id" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "market_id" TEXT,
    "week_id" TEXT,
    "player_id" TEXT,
    "reason" TEXT,
    "previous_state" TEXT,
    "next_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_events" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "type" "MarketEventType" NOT NULL,
    "user_id" TEXT,
    "trade_id" TEXT,
    "settlement_id" TEXT,
    "price_before" DECIMAL(8,6),
    "price_after" DECIMAL(8,6),
    "liquidity" DECIMAL(14,6),
    "volume" DECIMAL(14,2),
    "open_interest" DECIMAL(14,6),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "pnl" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "nfl_weeks_season_week_key" ON "nfl_weeks"("season", "week");

-- CreateIndex
CREATE INDEX "games_week_id_idx" ON "games"("week_id");

-- CreateIndex
CREATE INDEX "games_kickoff_time_idx" ON "games"("kickoff_time");

-- CreateIndex
CREATE INDEX "markets_week_id_position_idx" ON "markets"("week_id", "position");

-- CreateIndex
CREATE INDEX "markets_status_kickoff_time_idx" ON "markets"("status", "kickoff_time");

-- CreateIndex
CREATE UNIQUE INDEX "markets_player_id_week_id_threshold_type_key" ON "markets"("player_id", "week_id", "threshold_type");

-- CreateIndex
CREATE INDEX "trades_user_id_created_at_idx" ON "trades"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "trades_market_id_created_at_idx" ON "trades"("market_id", "created_at");

-- CreateIndex
CREATE INDEX "positions_market_id_idx" ON "positions"("market_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_user_id_market_id_key" ON "positions"("user_id", "market_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_market_id_key" ON "settlements"("market_id");

-- CreateIndex
CREATE INDEX "settlements_settled_at_idx" ON "settlements"("settled_at");

-- CreateIndex
CREATE UNIQUE INDEX "account_ledger_entries_idempotency_key_key" ON "account_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "account_ledger_entries_user_id_created_at_idx" ON "account_ledger_entries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "account_ledger_entries_market_id_created_at_idx" ON "account_ledger_entries"("market_id", "created_at");

-- CreateIndex
CREATE INDEX "account_ledger_entries_trade_id_idx" ON "account_ledger_entries"("trade_id");

-- CreateIndex
CREATE INDEX "account_ledger_entries_settlement_id_idx" ON "account_ledger_entries"("settlement_id");

-- CreateIndex
CREATE INDEX "account_ledger_entries_admin_id_created_at_idx" ON "account_ledger_entries"("admin_id", "created_at");

-- CreateIndex
CREATE INDEX "account_ledger_entries_type_created_at_idx" ON "account_ledger_entries"("type", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_created_at_idx" ON "admin_audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_market_id_created_at_idx" ON "admin_audit_logs"("market_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "market_events_market_id_created_at_idx" ON "market_events"("market_id", "created_at");

-- CreateIndex
CREATE INDEX "market_events_type_created_at_idx" ON "market_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "leaderboard_entries_week_id_rank_idx" ON "leaderboard_entries"("week_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_user_id_week_id_key" ON "leaderboard_entries"("user_id", "week_id");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "nfl_weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "nfl_weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_ledger_entries" ADD CONSTRAINT "account_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_ledger_entries" ADD CONSTRAINT "account_ledger_entries_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_ledger_entries" ADD CONSTRAINT "account_ledger_entries_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_ledger_entries" ADD CONSTRAINT "account_ledger_entries_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_ledger_entries" ADD CONSTRAINT "account_ledger_entries_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_events" ADD CONSTRAINT "market_events_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_events" ADD CONSTRAINT "market_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_events" ADD CONSTRAINT "market_events_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_events" ADD CONSTRAINT "market_events_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "nfl_weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only ledger enforcement. Local maintenance scripts may set
-- fantasyx.allow_ledger_mutation = 'on' inside a transaction before cleanup.
CREATE OR REPLACE FUNCTION prevent_account_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  IF current_setting('fantasyx.allow_ledger_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'account_ledger_entries is append-only; % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_ledger_entries_no_update
BEFORE UPDATE ON "account_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_account_ledger_mutation();

CREATE TRIGGER account_ledger_entries_no_delete
BEFORE DELETE ON "account_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_account_ledger_mutation();

