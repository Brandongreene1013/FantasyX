-- FX-007 Market Intelligence & Analytics
-- Additive market price history read model for charts and analytics.

CREATE TABLE "market_price_history" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "yes_price" DECIMAL(8,6) NOT NULL,
    "no_price" DECIMAL(8,6) NOT NULL,
    "liquidity" DECIMAL(14,6) NOT NULL,
    "volume" DECIMAL(14,2) NOT NULL,
    "open_interest" DECIMAL(14,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MARKET_EVENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "market_price_history_market_id_created_at_idx" ON "market_price_history"("market_id", "created_at");

ALTER TABLE "market_price_history"
ADD CONSTRAINT "market_price_history_market_id_fkey"
FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
