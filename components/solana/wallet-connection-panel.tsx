"use client";

import { useEffect, useState } from "react";
import { Link2, Send, ShieldCheck, Wallet } from "lucide-react";
import { apiGet, apiPost } from "@/lib/client-api";
import {
  connectInjectedWallet,
  sendDevnetMemoTransaction,
  signWalletChallenge
} from "@/packages/solana-client/src/browser";

type WalletRecord = {
  id: string;
  address: string;
  cluster: "LOCALNET" | "DEVNET" | "MAINNET_BETA";
  status: "ACTIVE" | "REVOKED";
  verifiedAt: string;
  transactions: Array<{
    id: string;
    kind: string;
    status: string;
    signature: string | null;
    createdAt: string;
  }>;
};

type WalletsResponse = { wallets: WalletRecord[] };

type ChallengeResponse = {
  challengeId: string;
  address: string;
  cluster: string;
  message: string;
  expiresAt: string;
};

type VerifyResponse = { wallet: WalletRecord };

type DevnetMemoResponse = {
  transaction: {
    id: string;
    status: string;
    signature: string | null;
    slot: string | null;
  };
};

export function WalletConnectionPanel() {
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [memo, setMemo] = useState("FantasyX devnet boundary test");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refreshWallets();
  }, []);

  async function refreshWallets() {
    const data = await apiGet<WalletsResponse>("/api/blockchain/wallets");
    setWallets(data.wallets);
  }

  async function connectAndVerify() {
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const address = await connectInjectedWallet();
      setConnectedAddress(address);
      const challenge = await apiPost<ChallengeResponse>("/api/blockchain/wallet/challenge", { address });
      const signature = await signWalletChallenge(challenge.message);
      await apiPost<VerifyResponse>("/api/blockchain/wallet/verify", {
        challengeId: challenge.challengeId,
        address: challenge.address,
        signature
      });
      await refreshWallets();
      setMessage("Wallet verified for devnet testing.");
    } catch (walletError) {
      setError(walletError instanceof Error ? walletError.message : "Could not verify wallet");
    } finally {
      setIsBusy(false);
    }
  }

  async function sendMemo() {
    const address = connectedAddress ?? wallets.find((wallet) => wallet.cluster === "DEVNET" && wallet.status === "ACTIVE")?.address;
    if (!address) {
      setError("Verify a devnet wallet first.");
      return;
    }
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const signature = await sendDevnetMemoTransaction({ walletAddress: address, memo });
      const recorded = await apiPost<DevnetMemoResponse>("/api/blockchain/transactions/devnet-memo", {
        signature,
        walletAddress: address,
        memo,
        idempotencyKey: `devnet_memo:${signature}`
      });
      await refreshWallets();
      setMessage(`Devnet memo recorded as ${recorded.transaction.status}.`);
    } catch (memoError) {
      setError(memoError instanceof Error ? memoError.message : "Could not send devnet memo");
    } finally {
      setIsBusy(false);
    }
  }

  const activeDevnetWallet = wallets.find((wallet) => wallet.cluster === "DEVNET" && wallet.status === "ACTIVE");

  return (
    <section className="mx-auto mt-5 max-w-2xl rounded border border-rim bg-panel p-5" aria-labelledby="wallet-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="wallet-heading" className="flex items-center gap-2 text-lg font-black text-frost">
            <Wallet className="h-5 w-5 text-neon" aria-hidden="true" />
            Solana Wallet
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted">Devnet-only identity and transaction testing. FantasyX balances remain mock credits.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-neon/30 bg-neon/10 px-3 py-2 text-xs font-black text-neon disabled:opacity-50"
          type="button"
          disabled={isBusy}
          onClick={connectAndVerify}
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
          {activeDevnetWallet ? "Re-verify" : "Connect"}
        </button>
      </div>

      {activeDevnetWallet ? (
        <div className="mt-4 rounded border border-field/25 bg-field/10 p-3">
          <p className="flex items-center gap-2 text-sm font-black text-field">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Verified devnet wallet
          </p>
          <p className="mt-1 break-all font-mono text-xs text-frost">{activeDevnetWallet.address}</p>
        </div>
      ) : (
        <p className="mt-4 rounded border border-rim bg-panel2 p-3 text-sm font-semibold text-muted">
          Install or unlock an injected Solana wallet, then verify ownership with a signed message.
        </p>
      )}

      <div className="mt-4 grid gap-3">
        <label className="text-sm font-black text-frost" htmlFor="devnetMemo">Devnet Memo</label>
        <input
          id="devnetMemo"
          className="rounded border border-rim bg-panel2 px-3 py-2 text-sm font-semibold text-frost"
          value={memo}
          maxLength={180}
          onChange={(event) => setMemo(event.target.value)}
        />
        <button
          className="inline-flex w-fit items-center gap-2 rounded bg-field px-4 py-3 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={isBusy || !activeDevnetWallet}
          onClick={sendMemo}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send devnet memo
        </button>
      </div>

      {error ? <p className="mt-4 rounded bg-rush/10 px-3 py-2 text-sm font-bold text-rush" role="alert">{error}</p> : null}
      {message ? <p className="mt-4 rounded bg-field/10 px-3 py-2 text-sm font-bold text-field" role="status">{message}</p> : null}

      {activeDevnetWallet?.transactions.length ? (
        <div className="mt-4 grid gap-2">
          {activeDevnetWallet.transactions.map((transaction) => (
            <div key={transaction.id} className="rounded border border-rim bg-panel2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-muted">
                <span>{transaction.kind}</span>
                <span>{transaction.status}</span>
              </div>
              {transaction.signature ? <p className="mt-1 break-all font-mono text-xs text-frost">{transaction.signature}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
