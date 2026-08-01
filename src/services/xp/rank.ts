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

export interface RankBand {
  tier: RankTier;
  /// Inclusive account-level bounds. `max` is null for the open-ended top tier.
  min: number;
  max: number | null;
  /// Whether this tier is divided into IV..I sub-bands. False for Master and
  /// above, which have no division.
  hasDivisions: boolean;
}

// Level bands, in ascending order. Challenger is open-ended (100+).
export const RANK_BANDS: readonly RankBand[] = [
  { tier: "IRON", min: 1, max: 4, hasDivisions: true },
  { tier: "BRONZE", min: 5, max: 12, hasDivisions: true },
  { tier: "SILVER", min: 13, max: 22, hasDivisions: true },
  { tier: "GOLD", min: 23, max: 34, hasDivisions: true },
  { tier: "PLATINUM", min: 35, max: 48, hasDivisions: true },
  { tier: "DIAMOND", min: 49, max: 64, hasDivisions: true },
  { tier: "MASTER", min: 65, max: 79, hasDivisions: false },
  { tier: "GRANDMASTER", min: 80, max: 99, hasDivisions: false },
  { tier: "CHALLENGER", min: 100, max: null, hasDivisions: false },
];

export interface Rank {
  tier: RankTier;
  /// 4 (lowest) down to 1 (highest) within the tier. Null for tiers with no
  /// division (Master and above).
  division: number | null;
}

function bandFor(level: number): RankBand {
  // Levels at or below the lowest band's floor clamp to that floor (Iron IV),
  // so this lookup is total for all inputs once clamped by the caller.
  const clamped = Math.max(level, RANK_BANDS[0].min);
  const band = RANK_BANDS.find((b) => clamped >= b.min && (b.max === null || clamped <= b.max));
  if (!band) {
    throw new Error(`No rank band covers level ${clamped}`);
  }
  return band;
}

/// Splits a divided tier's level span into four equal-width bands and
/// returns which one `level` falls in, as a division number (IV=4, lowest,
/// down to I=1, highest). The span is divided by width, so an uneven span
/// (e.g. 8 levels / 4 = 2 each) splits evenly; remainders (spans not
/// divisible by 4) are absorbed into the top division (I) by using floor
/// division on the offset.
function divisionFor(band: RankBand, level: number): number {
  if (!band.hasDivisions || band.max === null) return 1;

  const span = band.max - band.min + 1;
  const bandWidth = span / 4;
  const offset = level - band.min;

  // Division IV covers offsets [0, bandWidth), III [bandWidth, 2*bandWidth), ...
  const divisionIndexFromBottom = Math.min(3, Math.floor(offset / bandWidth));
  return 4 - divisionIndexFromBottom;
}

export function rankForLevel(level: number): Rank {
  // Clamp to a minimum of level 1: a freshly created profile (level 0) or
  // any invalid negative level should resolve to the lowest rank (Iron IV)
  // rather than throwing.
  const clampedLevel = Math.max(level, 1);
  const band = bandFor(clampedLevel);
  return {
    tier: band.tier,
    division: band.hasDivisions ? divisionFor(band, clampedLevel) : null,
  };
}
