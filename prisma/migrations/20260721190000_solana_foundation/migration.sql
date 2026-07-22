CREATE TYPE "BlockchainCluster" AS ENUM ('LOCALNET', 'DEVNET', 'MAINNET_BETA');
CREATE TYPE "BlockchainWalletStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "WalletChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'CONSUMED');
CREATE TYPE "BlockchainTransactionKind" AS ENUM (
  'WALLET_VERIFICATION',
  'DEVNET_MEMO',
  'DEVNET_AIRDROP',
  'FUTURE_COLLATERAL_DEPOSIT',
  'FUTURE_MARKET_ESCROW',
  'FUTURE_SETTLEMENT',
  'FUTURE_WITHDRAWAL'
);
CREATE TYPE "BlockchainTransactionStatus" AS ENUM (
  'CREATED',
  'SIGNATURE_COLLECTED',
  'SUBMITTED',
  'CONFIRMED',
  'FINALIZED',
  'FAILED',
  'EXPIRED'
);

CREATE TABLE "blockchain_wallets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "cluster" "BlockchainCluster" NOT NULL DEFAULT 'DEVNET',
  "address" TEXT NOT NULL,
  "status" "BlockchainWalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "verified_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "verification_message" TEXT NOT NULL,
  "verification_signature" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "blockchain_wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_challenges" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "cluster" "BlockchainCluster" NOT NULL DEFAULT 'DEVNET',
  "address" TEXT NOT NULL,
  "nonce_hash" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "WalletChallengeStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blockchain_transactions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "wallet_id" TEXT,
  "cluster" "BlockchainCluster" NOT NULL DEFAULT 'DEVNET',
  "kind" "BlockchainTransactionKind" NOT NULL,
  "status" "BlockchainTransactionStatus" NOT NULL DEFAULT 'CREATED',
  "signature" TEXT,
  "reference_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "slot" BIGINT,
  "error" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "submitted_at" TIMESTAMP(3),
  "confirmed_at" TIMESTAMP(3),
  CONSTRAINT "blockchain_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blockchain_wallets_cluster_address_key" ON "blockchain_wallets"("cluster", "address");
CREATE INDEX "blockchain_wallets_user_id_status_idx" ON "blockchain_wallets"("user_id", "status");
CREATE UNIQUE INDEX "wallet_challenges_nonce_hash_key" ON "wallet_challenges"("nonce_hash");
CREATE INDEX "wallet_challenges_user_id_status_expires_at_idx" ON "wallet_challenges"("user_id", "status", "expires_at");
CREATE INDEX "wallet_challenges_address_cluster_idx" ON "wallet_challenges"("address", "cluster");
CREATE UNIQUE INDEX "blockchain_transactions_signature_key" ON "blockchain_transactions"("signature");
CREATE UNIQUE INDEX "blockchain_transactions_idempotency_key_key" ON "blockchain_transactions"("idempotency_key");
CREATE INDEX "blockchain_transactions_user_id_created_at_idx" ON "blockchain_transactions"("user_id", "created_at");
CREATE INDEX "blockchain_transactions_cluster_status_created_at_idx" ON "blockchain_transactions"("cluster", "status", "created_at");
CREATE INDEX "blockchain_transactions_kind_created_at_idx" ON "blockchain_transactions"("kind", "created_at");

ALTER TABLE "blockchain_wallets" ADD CONSTRAINT "blockchain_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_challenges" ADD CONSTRAINT "wallet_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "blockchain_wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
