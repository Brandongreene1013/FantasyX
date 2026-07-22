import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import { Buffer } from "buffer";
import bs58 from "bs58";
import { getSolanaRuntimeConfig } from "@/packages/solana-config/src";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export type InjectedSolanaWallet = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  signMessage?: (message: Uint8Array, display?: "utf8" | "hex") => Promise<{ signature: Uint8Array } | Uint8Array>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<{ signature: string }>;
};

declare global {
  interface Window {
    solana?: InjectedSolanaWallet;
  }
}

export function getInjectedSolanaWallet() {
  if (typeof window === "undefined") return null;
  return window.solana ?? null;
}

export async function connectInjectedWallet() {
  const wallet = getInjectedSolanaWallet();
  if (!wallet) {
    throw new Error("No injected Solana wallet found");
  }
  const result = await wallet.connect();
  return result.publicKey.toBase58();
}

export async function signWalletChallenge(message: string) {
  const wallet = getInjectedSolanaWallet();
  if (!wallet?.signMessage) {
    throw new Error("This wallet does not support message signing");
  }
  const signed = await wallet.signMessage(new TextEncoder().encode(message), "utf8");
  const signature = signed instanceof Uint8Array ? signed : signed.signature;
  return bs58.encode(signature);
}

export async function sendDevnetMemoTransaction(input: { walletAddress: string; memo: string }) {
  const wallet = getInjectedSolanaWallet();
  if (!wallet?.signAndSendTransaction) {
    throw new Error("This wallet does not support transaction signing");
  }

  const config = getSolanaRuntimeConfig({
    NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  });
  const connection = new Connection(config.rpcUrl, "confirmed");
  const payer = new PublicKey(input.walletAddress);
  const transaction = new Transaction().add(new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(input.memo, "utf8")
  }));
  transaction.feePayer = payer;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;

  const { signature } = await wallet.signAndSendTransaction(transaction);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}
