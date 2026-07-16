CREATE TYPE "BetaEventType" AS ENUM (
  'SIGNUP',
  'REFERRAL_SIGNUP',
  'ONBOARDING_COMPLETE',
  'FIRST_TRADE',
  'MARKET_SHARE',
  'INVITE_COPY'
);

CREATE TABLE "beta_events" (
  "id" TEXT NOT NULL,
  "type" "BetaEventType" NOT NULL,
  "user_id" TEXT,
  "market_id" TEXT,
  "referrer_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "beta_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "beta_events_type_created_at_idx" ON "beta_events"("type", "created_at");
CREATE INDEX "beta_events_user_id_created_at_idx" ON "beta_events"("user_id", "created_at");
CREATE INDEX "beta_events_market_id_created_at_idx" ON "beta_events"("market_id", "created_at");
CREATE INDEX "beta_events_referrer_id_created_at_idx" ON "beta_events"("referrer_id", "created_at");

ALTER TABLE "beta_events"
  ADD CONSTRAINT "beta_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "beta_events"
  ADD CONSTRAINT "beta_events_referrer_id_fkey"
  FOREIGN KEY ("referrer_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
