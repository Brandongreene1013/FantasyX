import { createHash, randomBytes } from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { assertSupportedPublicKey, type SupportedSolanaCluster } from "@/packages/solana-config/src";

export type WalletChallengeMessageInput = {
  appName: string;
  domain: string;
  userId: string;
  address: string;
  cluster: SupportedSolanaCluster;
  nonce: string;
  issuedAt: Date;
};

export function createWalletNonce() {
  return randomBytes(24).toString("base64url");
}

export function hashWalletNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

export function buildWalletChallengeMessage(input: WalletChallengeMessageInput) {
  return [
    `${input.appName} wallet verification`,
    `Domain: ${input.domain}`,
    `Wallet: ${input.address}`,
    `Cluster: ${input.cluster}`,
    `User: ${input.userId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    "This signature links a Solana wallet to a FantasyX account. It does not authorize trades, deposits, withdrawals, or real-money activity."
  ].join("\n");
}

export function verifyWalletSignature(input: { address: string; message: string; signature: string }) {
  const publicKey = assertSupportedPublicKey(input.address);
  const signatureBytes = decodeSignature(input.signature);
  const messageBytes = new TextEncoder().encode(input.message);
  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
}

function decodeSignature(signature: string) {
  try {
    return bs58.decode(signature);
  } catch {
    return Uint8Array.from(Buffer.from(signature, "base64"));
  }
}
