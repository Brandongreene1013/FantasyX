export type BlockchainMode =
  | "OFF_CHAIN_SIMULATED_TRADE"
  | "DEVNET_TEST_TRANSACTION"
  | "FUTURE_ON_CHAIN_COLLATERAL"
  | "FUTURE_ON_CHAIN_SETTLEMENT";

export type BlockchainTransactionIntent =
  | "WALLET_VERIFICATION"
  | "DEVNET_MEMO"
  | "DEVNET_AIRDROP"
  | "FUTURE_COLLATERAL_DEPOSIT"
  | "FUTURE_MARKET_ESCROW"
  | "FUTURE_SETTLEMENT"
  | "FUTURE_WITHDRAWAL";

export type BlockchainTransactionLifecycle =
  | "CREATED"
  | "SIGNATURE_COLLECTED"
  | "SUBMITTED"
  | "CONFIRMED"
  | "FINALIZED"
  | "FAILED"
  | "EXPIRED";

export const BLOCKCHAIN_BOUNDARY = {
  offChainLedgerIsAuthoritative: true,
  productionCryptoBalancesEnabled: false,
  mainnetTransactionsEnabled: false,
  supportedSprintMode: "DEVNET_TEST_TRANSACTION" satisfies BlockchainMode
};

export type ProtocolMarketStatus =
  | "REGISTERED"
  | "COLLATERALIZED"
  | "TRADING"
  | "LOCKED"
  | "RESULT_PROPOSED"
  | "RESOLVED"
  | "CANCELLED";

export type ProtocolMarketResult = "UNRESOLVED" | "YES" | "NO" | "CANCELLED";

export type ProtocolSolvencySnapshot = {
  status: ProtocolMarketStatus;
  result: ProtocolMarketResult;
  yesLiability: bigint;
  noLiability: bigint;
  collateralEscrowed: bigint;
  feesAccrued: bigint;
};

export function requiredProtocolBacking(snapshot: ProtocolSolvencySnapshot) {
  let liabilities: bigint;
  if (snapshot.status === "CANCELLED") {
    liabilities = snapshot.yesLiability + snapshot.noLiability;
  } else if (snapshot.status === "RESOLVED" && snapshot.result === "YES") {
    liabilities = snapshot.yesLiability;
  } else if (snapshot.status === "RESOLVED" && snapshot.result === "NO") {
    liabilities = snapshot.noLiability;
  } else {
    liabilities = snapshot.yesLiability > snapshot.noLiability ? snapshot.yesLiability : snapshot.noLiability;
  }
  return liabilities + snapshot.feesAccrued;
}

export function isProtocolMarketSolvent(snapshot: ProtocolSolvencySnapshot) {
  return snapshot.collateralEscrowed >= requiredProtocolBacking(snapshot);
}
