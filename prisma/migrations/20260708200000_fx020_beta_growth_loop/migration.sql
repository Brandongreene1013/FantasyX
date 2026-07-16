ALTER TABLE "users"
  ADD COLUMN "referral_code" TEXT,
  ADD COLUMN "referred_by_user_id" TEXT;

CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");
CREATE INDEX "users_referred_by_user_id_idx" ON "users"("referred_by_user_id");

ALTER TABLE "users"
  ADD CONSTRAINT "users_referred_by_user_id_fkey"
  FOREIGN KEY ("referred_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
