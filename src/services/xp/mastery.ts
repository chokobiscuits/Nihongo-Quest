/// Base mastery XP for a correct answer, before stage scaling.
export const MASTERY_XP_BASE = 5;
/// Per-stage mastery XP bonus for a correct answer: higher stages are worth
/// more, mirroring how review XP scales by stage.
export const MASTERY_XP_PER_STAGE = 2;

/// Mastery XP awarded for one correct answer at a given SRS stage. Unlike
/// SRS XP, this never decreases and has no incorrect-answer counterpart — it
/// tracks cumulative familiarity with an item, not current recall
/// confidence. Weighted by stage the same way review XP is: 7 at Apprentice
/// I, 21 at Enlightened.
export function masteryXpForAnswer(srsStage: number): number {
  return MASTERY_XP_BASE + srsStage * MASTERY_XP_PER_STAGE;
}

/// masteryLevel = floor(sqrt(masteryXp / 25)). Unbounded: there is no cap on
/// how mastered an item can become.
export function masteryLevelFromXp(masteryXp: number): number {
  return Math.floor(Math.sqrt(masteryXp / 25));
}

// Account mastery is derived, not a new XP pool: it is the sum of every
// UserSubject.masteryXp the user has. It uses the same curve shape as item
// mastery (floor(sqrt(xp / divisor))) but scaled 10x wider, since the
// account pool sums across hundreds of items and would otherwise blow
// through levels instantly. Exported so the scale is retunable in one place.
export const ACCOUNT_MASTERY_DIVISOR = 250;

/// accountMasteryLevel = floor(sqrt(totalMasteryXp / ACCOUNT_MASTERY_DIVISOR)).
/// Unbounded, same shape as `masteryLevelFromXp` at 10x scale. Monotonic in
/// `totalMasteryXp`.
export function accountMasteryLevel(totalMasteryXp: number): number {
  return Math.floor(Math.sqrt(totalMasteryXp / ACCOUNT_MASTERY_DIVISOR));
}

export interface MasteryTier {
  name: string;
  level: number;
  /// A `--color-*` custom property name (without `var()`), matching an
  /// existing token — never a fresh hex value.
  colorToken: string;
}

// Named tiers per Assets.png §19, mapped to level bands. Level 0 (nothing
// learned yet) is "Unranked" and rendered as Lv.0 rather than assigned a
// tier color. Bands above 5 widen as the level climbs; Transcendent (25+)
// is the terminal label — the level itself keeps climbing forever past it.
// No existing token matches the sheet's per-tier badge colors (radical/
// kanji/vocab/rank tokens are semantically tied elsewhere), so tiers reuse
// the closest fitting existing `--color-*` tokens by hue rather than
// inventing new hex values.
export const MASTERY_TIER_BANDS: readonly { name: string; min: number; colorToken: string }[] = [
  { name: "Unranked", min: 0, colorToken: "--color-text-faint" },
  { name: "Novice", min: 1, colorToken: "--color-text-dim" },
  { name: "Apprentice", min: 2, colorToken: "--color-rank-bronze" },
  { name: "Practitioner", min: 3, colorToken: "--color-rank-silver" },
  { name: "Adept", min: 4, colorToken: "--color-vocab" },
  { name: "Proficient", min: 5, colorToken: "--color-rank-gold" },
  { name: "Expert", min: 6, colorToken: "--color-rank-platinum" },
  { name: "Master", min: 10, colorToken: "--color-rank-diamond" },
  { name: "Sage", min: 15, colorToken: "--color-kanji" },
  { name: "Transcendent", min: 25, colorToken: "--color-rank-master" },
];

/// Resolves a mastery level to its named tier + display color. Level 0 maps
/// to "Unranked". The returned `level` is passed through unchanged so
/// callers can render `Lv.{level} {name}` from one object.
export function masteryTier(level: number): MasteryTier {
  let band = MASTERY_TIER_BANDS[0];
  for (const candidate of MASTERY_TIER_BANDS) {
    if (level >= candidate.min) band = candidate;
    else break;
  }
  return { name: band.name, level, colorToken: band.colorToken };
}

export interface MasteryProgress {
  level: number;
  /// XP already earned within the current level (0 at the exact level
  /// threshold).
  xpIntoLevel: number;
  /// XP required to go from this level to the next.
  xpForNextLevel: number;
}

/// Progress toward the next account mastery level, derived from the same
/// sqrt curve as `accountMasteryLevel`. `xpForNextLevel` is the XP delta
/// between the current level's threshold and the next level's threshold.
export function masteryProgress(totalMasteryXp: number): MasteryProgress {
  const level = accountMasteryLevel(totalMasteryXp);
  const xpAtLevel = level * level * ACCOUNT_MASTERY_DIVISOR;
  const xpAtNextLevel = (level + 1) * (level + 1) * ACCOUNT_MASTERY_DIVISOR;
  return {
    level,
    xpIntoLevel: totalMasteryXp - xpAtLevel,
    xpForNextLevel: xpAtNextLevel - xpAtLevel,
  };
}
