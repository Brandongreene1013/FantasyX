import { clusterApiUrl, PublicKey } from "@solana/web3.js";

export const FANTASYX_MARKET_PROGRAM_ID = "Fx11111111111111111111111111111111111111111";

export type SupportedSolanaCluster = "localnet" | "devnet" | "mainnet-beta";

export type SolanaRuntimeConfig = {
  cluster: SupportedSolanaCluster;
  rpcUrl: string;
  programId: string;
  allowMainnetTransactions: boolean;
};

export function getSolanaRuntimeConfig(env: Partial<NodeJS.ProcessEnv> = process.env): SolanaRuntimeConfig {
  const cluster = parseCluster(env.SOLANA_CLUSTER ?? env.NEXT_PUBLIC_SOLANA_CLUSTER);
  const rpcUrl = env.SOLANA_RPC_URL?.trim() || env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || defaultRpcUrl(cluster);
  const programId = env.SOLANA_FANTASYX_MARKET_PROGRAM_ID?.trim() || FANTASYX_MARKET_PROGRAM_ID;

  return {
    cluster,
    rpcUrl,
    programId,
    allowMainnetTransactions: env.SOLANA_ALLOW_MAINNET_TRANSACTIONS === "true"
  };
}

export function parseCluster(value: string | undefined): SupportedSolanaCluster {
  const normalized = (value ?? "devnet").trim().toLowerCase();
  if (normalized === "localnet" || normalized === "localhost") return "localnet";
  if (normalized === "devnet") return "devnet";
  if (normalized === "mainnet-beta" || normalized === "mainnet") return "mainnet-beta";
  return "devnet";
}

export function assertSupportedPublicKey(value: string) {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error("Invalid Solana public key");
  }
}

function defaultRpcUrl(cluster: SupportedSolanaCluster) {
  if (cluster === "localnet") return "http://127.0.0.1:8899";
  if (cluster === "devnet") return clusterApiUrl("devnet");
  return clusterApiUrl("mainnet-beta");
}
