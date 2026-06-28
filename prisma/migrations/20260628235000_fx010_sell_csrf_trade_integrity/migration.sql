ALTER TYPE "LedgerEntryType" ADD VALUE 'TRADE_PROCEEDS';

CREATE TYPE "TradeAction" AS ENUM ('BUY', 'SELL');

ALTER TABLE "trades"
ADD COLUMN "action" "TradeAction" NOT NULL DEFAULT 'BUY',
ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "trades_idempotency_key_key" ON "trades"("idempotency_key");
