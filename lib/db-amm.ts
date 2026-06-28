// FX-003: backward-compatible re-export barrel. Call service modules directly in new code.
export { executeDbBuy } from "@/lib/trade.service";
export { settleDbMarket, settleDbPlayerMarkets, lockDbMarket, openDbMarket } from "@/lib/settlement.service";
export { voidDbMarket } from "@/lib/void.service";
