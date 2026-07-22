CREATE TYPE "OnChainMarketStatus" AS ENUM ('REGISTERED', 'COLLATERALIZED', 'TRADING', 'LOCKED', 'RESULT_PROPOSED', 'RESOLVED', 'CANCELLED');
CREATE TYPE "OnChainMarketResult" AS ENUM ('UNRESOLVED', 'YES', 'NO', 'CANCELLED');
CREATE TYPE "OnChainQuoteAction" AS ENUM ('BUY', 'SELL');
CREATE TYPE "OnChainQuoteStatus" AS ENUM ('ISSUED', 'SUBMITTED', 'CONSUMED', 'EXPIRED', 'REJECTED');
CREATE TYPE "ReconciliationStatus" AS ENUM ('PASS', 'FAIL', 'PARTIAL');

CREATE TABLE "on_chain_markets" (
  "id" TEXT NOT NULL,
  "market_id" TEXT,
  "cluster" "BlockchainCluster" NOT NULL DEFAULT 'DEVNET',
  "program_id" TEXT NOT NULL,
  "market_pda" TEXT NOT NULL,
  "escrow_token_account" TEXT NOT NULL,
  "collateral_mint" TEXT NOT NULL,
  "liquidity_provider" TEXT NOT NULL,
  "status" "OnChainMarketStatus" NOT NULL DEFAULT 'REGISTERED',
  "result" "OnChainMarketResult" NOT NULL DEFAULT 'UNRESOLVED',
  "lock_time" TIMESTAMP(3) NOT NULL,
  "yes_liability" BIGINT NOT NULL DEFAULT 0,
  "no_liability" BIGINT NOT NULL DEFAULT 0,
  "collateral_escrowed" BIGINT NOT NULL DEFAULT 0,
  "fees_accrued" BIGINT NOT NULL DEFAULT 0,
  "last_signature" TEXT,
  "last_slot" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "on_chain_markets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "on_chain_positions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "on_chain_market_id" TEXT NOT NULL,
  "owner_address" TEXT NOT NULL,
  "position_pda" TEXT NOT NULL,
  "yes_shares" BIGINT NOT NULL DEFAULT 0,
  "no_shares" BIGINT NOT NULL DEFAULT 0,
  "claimed" BOOLEAN NOT NULL DEFAULT false,
  "last_signature" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "on_chain_positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "on_chain_events" (
  "id" TEXT NOT NULL,
  "on_chain_market_id" TEXT,
  "cluster" "BlockchainCluster" NOT NULL DEFAULT 'DEVNET',
  "signature" TEXT NOT NULL,
  "slot" BIGINT,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "on_chain_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "on_chain_quote_intents" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "on_chain_market_id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "action" "OnChainQuoteAction" NOT NULL,
  "side" "TradeSide" NOT NULL,
  "shares" BIGINT NOT NULL,
  "cost_or_proceeds" BIGINT NOT NULL,
  "slippage_bound" BIGINT NOT NULL,
  "status" "OnChainQuoteStatus" NOT NULL DEFAULT 'ISSUED',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "signature" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "on_chain_quote_intents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "on_chain_reconciliation_runs" (
  "id" TEXT NOT NULL,
  "on_chain_market_id" TEXT,
  "cluster" "BlockchainCluster" NOT NULL DEFAULT 'DEVNET',
  "status" "ReconciliationStatus" NOT NULL,
  "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summary" JSONB NOT NULL,
  "error" TEXT,
  CONSTRAINT "on_chain_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "on_chain_markets_market_pda_key" ON "on_chain_markets"("market_pda");
CREATE UNIQUE INDEX "on_chain_markets_cluster_program_id_market_pda_key" ON "on_chain_markets"("cluster", "program_id", "market_pda");
CREATE INDEX "on_chain_markets_market_id_idx" ON "on_chain_markets"("market_id");
CREATE INDEX "on_chain_markets_cluster_status_lock_time_idx" ON "on_chain_markets"("cluster", "status", "lock_time");
CREATE UNIQUE INDEX "on_chain_positions_position_pda_key" ON "on_chain_positions"("position_pda");
CREATE UNIQUE INDEX "on_chain_positions_on_chain_market_id_owner_address_key" ON "on_chain_positions"("on_chain_market_id", "owner_address");
CREATE INDEX "on_chain_positions_user_id_idx" ON "on_chain_positions"("user_id");
CREATE INDEX "on_chain_positions_owner_address_idx" ON "on_chain_positions"("owner_address");
CREATE UNIQUE INDEX "on_chain_events_signature_event_type_key" ON "on_chain_events"("signature", "event_type");
CREATE INDEX "on_chain_events_on_chain_market_id_created_at_idx" ON "on_chain_events"("on_chain_market_id", "created_at");
CREATE INDEX "on_chain_events_cluster_event_type_created_at_idx" ON "on_chain_events"("cluster", "event_type", "created_at");
CREATE UNIQUE INDEX "on_chain_quote_intents_on_chain_market_id_user_id_quote_id_key" ON "on_chain_quote_intents"("on_chain_market_id", "user_id", "quote_id");
CREATE INDEX "on_chain_quote_intents_user_id_created_at_idx" ON "on_chain_quote_intents"("user_id", "created_at");
CREATE INDEX "on_chain_quote_intents_status_expires_at_idx" ON "on_chain_quote_intents"("status", "expires_at");
CREATE INDEX "on_chain_reconciliation_runs_on_chain_market_id_checked_at_idx" ON "on_chain_reconciliation_runs"("on_chain_market_id", "checked_at");
CREATE INDEX "on_chain_reconciliation_runs_cluster_status_checked_at_idx" ON "on_chain_reconciliation_runs"("cluster", "status", "checked_at");

ALTER TABLE "on_chain_markets" ADD CONSTRAINT "on_chain_markets_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "on_chain_positions" ADD CONSTRAINT "on_chain_positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "on_chain_positions" ADD CONSTRAINT "on_chain_positions_on_chain_market_id_fkey" FOREIGN KEY ("on_chain_market_id") REFERENCES "on_chain_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "on_chain_events" ADD CONSTRAINT "on_chain_events_on_chain_market_id_fkey" FOREIGN KEY ("on_chain_market_id") REFERENCES "on_chain_markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "on_chain_quote_intents" ADD CONSTRAINT "on_chain_quote_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "on_chain_quote_intents" ADD CONSTRAINT "on_chain_quote_intents_on_chain_market_id_fkey" FOREIGN KEY ("on_chain_market_id") REFERENCES "on_chain_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "on_chain_reconciliation_runs" ADD CONSTRAINT "on_chain_reconciliation_runs_on_chain_market_id_fkey" FOREIGN KEY ("on_chain_market_id") REFERENCES "on_chain_markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
