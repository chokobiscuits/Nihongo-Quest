// The rank tier ladder.
//
// Previously (src/services/xp/rank.ts) each tier carried inclusive account
// *level* bounds and `rankForLevel(level)` projected XP onto a rank. Rank is
// now independent state driven by LP (see ./lp.ts), so the level bounds are
// gone: what survives is the ordered tier list and whether each tier is
// divided into IV..I.

export type RankTier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

export interface Rank {
  tier: RankTier;
  /// 4 (lowest) down to 1 (highest) within the tier. Null for tiers with no
  /// division (Master and above), which share one unbounded LP pool.
  division: number | null;
}

export interface RankTierInfo {
  tier: RankTier;
  /// Whether this tier is divided into IV..I sub-bands. False for Master and
  /// above.
  hasDivisions: boolean;
}

/// Tiers in ascending order. Index in this array IS the rank ordering, so
/// comparisons are index comparisons.
export const RANK_TIERS: readonly RankTierInfo[] = [
  { tier: "IRON", hasDivisions: true },
  { tier: "BRONZE", hasDivisions: true },
  { tier: "SILVER", hasDivisions: true },
  { tier: "GOLD", hasDivisions: true },
  { tier: "PLATINUM", hasDivisions: true },
  { tier: "DIAMOND", hasDivisions: true },
  { tier: "MASTER", hasDivisions: false },
  { tier: "GRANDMASTER", hasDivisions: false },
  { tier: "CHALLENGER", hasDivisions: false },
];

export function tierIndex(tier: RankTier): number {
  const index = RANK_TIERS.findIndex((t) => t.tier === tier);
  if (index === -1) throw new Error(`Unknown rank tier: ${tier}`);
  return index;
}

export function tierAt(index: number): RankTier {
  const clamped = Math.min(RANK_TIERS.length - 1, Math.max(0, index));
  return RANK_TIERS[clamped].tier;
}

export function hasDivisions(tier: RankTier): boolean {
  return RANK_TIERS[tierIndex(tier)].hasDivisions;
}

/// Ordering comparison: positive when `a` outranks `b`.
export function compareTiers(a: RankTier, b: RankTier): number {
  return tierIndex(a) - tierIndex(b);
}

/// Parses a tier string from the database, falling back to IRON. The column
/// is a plain String with no DB-level constraint, so this is the guard.
export function parseTier(value: string): RankTier {
  const found = RANK_TIERS.find((t) => t.tier === value);
  return found ? found.tier : "IRON";
}
