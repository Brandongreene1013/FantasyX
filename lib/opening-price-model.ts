/**
 * Opening price model for FantasyX markets.
 *
 * Converts player projection + positional context into a YES probability for
 * a rank-based fantasy market (Top 3 / Top 5 / Top 10).
 *
 * Assumptions:
 *  - Projections are half-PPR fantasy points for a single week.
 *  - Expected positional rank is inferred by mapping projection onto a
 *    position-specific projection curve (elite → rank 1, avg starter → rank ~12).
 *  - Probability is a logistic-style decay centered on the threshold rank.
 *  - Status penalties reduce the price if player is questionable/doubtful/out.
 *  - Final price uses threshold-specific floors/caps so easier contracts do not
 *    collapse to the same displayed price as harder contracts.
 */

export type PlayerStatus = "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "OUT";
export type ThresholdType = "TOP_3" | "TOP_5" | "TOP_10";
export type Position = "QB" | "RB" | "WR" | "TE";
export type PricingContext = {
  adpRank?: number;
  matchupAdjustment?: number;
};

/**
 * Typical projection range and starter pool size by position.
 * elite = top-1 projection, floor = borderline-starter projection
 * poolSize = typical number of meaningful starters per week
 */
const POSITION_PROFILE: Record<Position, { elite: number; floor: number; poolSize: number }> = {
  QB:  { elite: 28,  floor: 12,  poolSize: 18 },
  RB:  { elite: 24,  floor: 8,   poolSize: 30 },
  WR:  { elite: 25,  floor: 7,   poolSize: 40 },
  TE:  { elite: 18,  floor: 5,   poolSize: 15 },
};

/**
 * Steepness of the probability slope around the threshold rank.
 * Smaller k = wider/flatter distribution; larger = sharper cliff.
 */
const THRESHOLD_STEEPNESS: Record<ThresholdType, number> = {
  TOP_3:  0.55,
  TOP_5:  0.45,
  TOP_10: 0.35,
};

/** Status multipliers applied after probability is calculated */
const STATUS_MULTIPLIER: Record<PlayerStatus, number> = {
  ACTIVE:       1.00,
  QUESTIONABLE: 0.80,
  DOUBTFUL:     0.45,
  OUT:          0.05,
};

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function round6(v: number) { return Math.round(v * 1_000_000) / 1_000_000; }

/**
 * Convert a projection into an estimated positional rank.
 * Linear interpolation between elite (rank 1) and floor (rank poolSize).
 */
function projectionToRank(projection: number, position: Position): number {
  const { elite, floor, poolSize } = POSITION_PROFILE[position];
  const safeProj = clamp(projection, 0, elite);
  // rank 1 at elite, rank poolSize at floor
  const t = clamp((safeProj - floor) / (elite - floor), 0, 1);
  return poolSize - t * (poolSize - 1);
}

/**
 * Logistic probability that a player with expectedRank finishes inside threshold.
 */
function rankToProb(expectedRank: number, threshold: ThresholdType): number {
  const cutoff = threshold === "TOP_3" ? 3 : threshold === "TOP_5" ? 5 : 10;
  const k = THRESHOLD_STEEPNESS[threshold];
  // Positive when rank <= cutoff (likely inside); negative when above
  const x = (cutoff - expectedRank + 0.5) * k;
  return 1 / (1 + Math.exp(-x));
}

/**
 * Main export: returns opening YES probability (0.05 – 0.95).
 */
export function calcOpeningYesPrice(
  projection: number,
  position: Position,
  threshold: ThresholdType,
  status: PlayerStatus = "ACTIVE",
  context: PricingContext = {}
): number {
  const expectedRank = projectionToRank(projection + (context.matchupAdjustment ?? 0), position);
  const baseProb = rankToProb(expectedRank, threshold);
  const statusAdj = (baseProb + adpConfidenceAdjustment(context.adpRank, threshold)) * STATUS_MULTIPLIER[status];
  return round6(clamp(statusAdj, MIN_PRICE[threshold], MAX_PRICE[threshold]));
}

const MIN_PRICE: Record<ThresholdType, number> = {
  TOP_3: 0.01,
  TOP_5: 0.03,
  TOP_10: 0.06,
};

const MAX_PRICE: Record<ThresholdType, number> = {
  TOP_3: 0.92,
  TOP_5: 0.96,
  TOP_10: 0.98,
};

function adpConfidenceAdjustment(adpRank: number | undefined, threshold: ThresholdType) {
  if (!adpRank || adpRank <= 0) return 0;

  const anchor = threshold === "TOP_3" ? 24 : threshold === "TOP_5" ? 48 : 96;
  const raw = (anchor - adpRank) / anchor;
  return clamp(raw * 0.08, -0.05, 0.08);
}

/**
 * Derives initial AMM pool values consistent with the opening probability.
 * Returns { yesPrice, noPrice, yesPool, noPool } for a given total liquidity.
 *
 * In the constant-product AMM: yesPool * noPool = k
 * yesPrice = noPool / (yesPool + noPool)
 * → noPool / totalPool = yesPrice → noPool = yesPrice * totalPool
 * → yesPool = totalPool - noPool
 */
export function calcInitialPools(yesPrice: number, totalLiquidity = 500) {
  const noPool  = Math.round(yesPrice * totalLiquidity * 100) / 100;
  const yesPool = Math.round((1 - yesPrice) * totalLiquidity * 100) / 100;
  return { yesPrice, noPrice: round6(1 - yesPrice), yesPool, noPool };
}
