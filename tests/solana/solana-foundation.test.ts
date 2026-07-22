import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { BLOCKCHAIN_BOUNDARY } from "@/packages/blockchain-domain/src";
import {
  buildWalletChallengeMessage,
  createWalletNonce,
  hashWalletNonce,
  verifyWalletSignature
} from "@/packages/solana-client/src";
import { getSolanaRuntimeConfig, parseCluster } from "@/packages/solana-config/src";

describe("Solana foundation boundary", () => {
  it("keeps production crypto disabled for this sprint", () => {
    expect(BLOCKCHAIN_BOUNDARY.offChainLedgerIsAuthoritative).toBe(true);
    expect(BLOCKCHAIN_BOUNDARY.productionCryptoBalancesEnabled).toBe(false);
    expect(BLOCKCHAIN_BOUNDARY.mainnetTransactionsEnabled).toBe(false);
    expect(BLOCKCHAIN_BOUNDARY.supportedSprintMode).toBe("DEVNET_TEST_TRANSACTION");
  });

  it("defaults Solana configuration to devnet", () => {
    const config = getSolanaRuntimeConfig({});
    expect(config.cluster).toBe("devnet");
    expect(config.rpcUrl).toContain("devnet");
    expect(config.allowMainnetTransactions).toBe(false);
    expect(parseCluster("mainnet")).toBe("mainnet-beta");
    expect(parseCluster("unknown")).toBe("devnet");
  });

  it("verifies a wallet ownership challenge signature", () => {
    const keypair = Keypair.generate();
    const nonce = createWalletNonce();
    const message = buildWalletChallengeMessage({
      appName: "FantasyX",
      domain: "localhost:3000",
      userId: "user_test",
      address: keypair.publicKey.toBase58(),
      cluster: "devnet",
      nonce,
      issuedAt: new Date("2026-07-21T00:00:00.000Z")
    });
    const signature = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);

    expect(hashWalletNonce(nonce)).toHaveLength(64);
    expect(verifyWalletSignature({
      address: keypair.publicKey.toBase58(),
      message,
      signature: bs58.encode(signature)
    })).toBe(true);
    expect(verifyWalletSignature({
      address: keypair.publicKey.toBase58(),
      message: `${message}\nchanged`,
      signature: bs58.encode(signature)
    })).toBe(false);
  });
});
