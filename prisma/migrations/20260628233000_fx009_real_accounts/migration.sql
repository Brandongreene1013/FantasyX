CREATE TYPE "UserRole" AS ENUM ('TRADER', 'ADMIN');

ALTER TABLE "users"
ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "display_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "password_hash" TEXT NOT NULL DEFAULT '',
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'TRADER';

UPDATE "users"
SET
  "display_name" = COALESCE(NULLIF("name", ''), 'FantasyX Trader'),
  "first_name" = COALESCE(NULLIF(split_part("name", ' ', 1), ''), 'FantasyX'),
  "last_name" = COALESCE(NULLIF(trim(substr("name", length(split_part("name", ' ', 1)) + 1)), ''), 'Trader'),
  "role" = CASE WHEN "is_admin" THEN 'ADMIN'::"UserRole" ELSE 'TRADER'::"UserRole" END;

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
