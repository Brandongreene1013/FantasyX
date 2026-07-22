import { Connection } from "@solana/web3.js";
import { getSolanaRuntimeConfig } from "@/packages/solana-config/src";

export function createSolanaConnection() {
  const config = getSolanaRuntimeConfig();
  if (config.cluster === "mainnet-beta" && !config.allowMainnetTransactions) {
    throw new Error("Solana mainnet transactions are disabled for FantasyX");
  }
  return new Connection(config.rpcUrl, "confirmed");
}
