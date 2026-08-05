// The LP (League Points) model: the "current performance" progression track,
// deliberately independent of XP/level.
//
// EXP measures time invested and only ever goes up. LP measures how well you
// are actually answering right now, and can go down. Rank was previously a
// pure projection of level (rankForLevel), which meant a rank could never
// fall and said nothing about performance — the veneer was hollow.
//
// Only ranked reviews and exams move LP. Lessons never do (they have no
// failure mode, so they could only ratchet upward), and unranked practice
// never does (its queue has no due-date filter, so items are re-servable
// forever and any LP award would be farmable).

import { RANK_TIERS, type Rank, type RankTier, tierIndex, tierAt, hasDivisions } from "./tiers";

/// Accuracy at which a session is LP-neutral. Above this you gain, below it
/// you lose. 80% is deliberately demanding: an SRS queue serves you the
/// items you are due to have forgotten, so a "good" session is not 100%.
export const NEUTRAL_ACCURACY = 0.8;

/// Accuracy span that maps to the full K swing. At NEUTRAL + SPAN you gain
/// the full K; at NEUTRAL - SPAN you lose it (before dampening).
export const ACCURACY_SPAN = 0.2;

/// Session-size coefficient. The LP swing scales with sqrt(items) so a
/// 3-item session cannot move rank meaningfully while a 40-item session is
/// not undervalued.
export const K_SIZE_COEFF = 4;
export const K_SIZE_MIN = 5;
export const K_SIZE_MAX = 30;

/// Losses are dampened: rank should trend up for a diligent learner, so one
/// bad session stings without erasing two good ones.
export const LOSS_DAMPENING = 0.75;

/// Sessions smaller than this award no LP at all, so a one-item session
/// cannot be used to ratchet rank upward.
export const MIN_RANKED_ITEMS = 3;

/// LP per division. Crossing this promotes; dropping below zero demotes.
export const LP_PER_DIVISION = 100;

/// Where you land after a demotion — not 99, so a single good session does
/// not immediately bounce you back and yo-yo the rank.
export const DEMOTION_LANDING_LP = 75;

/// Over-achievement multipliers. These are what make a double promotion
/// reachable: the base formula caps at K_SIZE_MAX (30), which can never
/// cross two 100-LP boundaries on its own.
///
/// PERFECT_MULTIPLIER is tuned so a perfect session at PERFECT_MIN_ITEMS or
/// more clears two divisions from a high-LP start. At K_SIZE_MAX the base
/// delta is 30, so 30 * 5 = 150 >= 2 * LP_PER_DIVISION - 95. A table test
/// pins this — if the multiplier or K cap changes, the double promotion has
/// to be re-verified rather than assumed.
export const S_RANK_ACCURACY = 0.95;
export const S_RANK_MIN_ITEMS = 15;
export const S_RANK_MULTIPLIER = 3;

export const PERFECT_MIN_ITEMS = 25;
export const PERFECT_MULTIPLIER = 5;

/// Master and above use a single unbounded LP pool instead of divisions.
export const GRANDMASTER_LP = 500;
export const CHALLENGER_LP = 1000;

export interface RankState {
  tier: RankTier;
  /// 4 (lowest) .. 1 (highest) within a divided tier; null for Master+.
  division: number | null;
  lp: number;
}

export interface LpSessionInput {
  /// Items answered cleanly (never missed) out of the session total. Per
  /// *item*, not per question — that is what "got it right" means to a user.
  itemsCorrect: number;
  itemsTotal: number;
  /// Exams swing harder than reviews.
  isExam?: boolean;
}

export interface LpOutcome {
  delta: number;
  before: RankState;
  after: RankState;
  /// How many division boundaries were crossed, signed. +2 is a double
  /// promotion; -1 a demotion.
  divisionsMoved: number;
  change: "promoted" | "demoted" | null;
  /// True when a tier boundary was crossed upward.
  tierPromoted: boolean;
  /// Set when the over-achievement multiplier applied, for the UI to call out.
  bonus: "s-rank" | "perfect" | null;
}

/// The raw LP swing for a session, before it is applied to a ladder
/// position. Exported for testing and for previewing "this session is worth
/// X LP" in the UI.
export function lpDeltaFor(input: LpSessionInput): { delta: number; bonus: LpOutcome["bonus"] } {
  const { itemsCorrect, itemsTotal, isExam = false } = input;

  if (itemsTotal < MIN_RANKED_ITEMS) return { delta: 0, bonus: null };

  const accuracy = itemsTotal === 0 ? 0 : itemsCorrect / itemsTotal;

  const kSize = Math.min(
    K_SIZE_MAX,
    Math.max(K_SIZE_MIN, Math.round(K_SIZE_COEFF * Math.sqrt(itemsTotal))),
  );
  const k = isExam ? kSize * 1.5 : kSize;

  let delta = Math.round((k * (accuracy - NEUTRAL_ACCURACY)) / ACCURACY_SPAN);

  let bonus: LpOutcome["bonus"] = null;
  if (delta > 0) {
    if (accuracy >= 1 && itemsTotal >= PERFECT_MIN_ITEMS) {
      delta *= PERFECT_MULTIPLIER;
      bonus = "perfect";
    } else if (accuracy >= S_RANK_ACCURACY && itemsTotal >= S_RANK_MIN_ITEMS) {
      delta *= S_RANK_MULTIPLIER;
      bonus = "s-rank";
    }
  } else if (delta < 0) {
    delta = Math.round(delta * LOSS_DAMPENING);
  }

  return { delta, bonus };
}

/// True once the tier has no divisions (Master and above), where LP is a
/// single unbounded pool and tier is a pure threshold on it.
function isApexTier(tier: RankTier): boolean {
  return !hasDivisions(tier);
}

/// Resolves an apex (Master+) LP pool to its tier. Grandmaster at 500,
/// Challenger at 1000.
function apexTierForLp(lp: number): RankTier {
  if (lp >= CHALLENGER_LP) return "CHALLENGER";
  if (lp >= GRANDMASTER_LP) return "GRANDMASTER";
  return "MASTER";
}

/// Applies an LP delta to a ladder position.
///
/// Promotion: crossing LP_PER_DIVISION promotes and carries the remainder,
/// looping — so a large enough gain genuinely crosses two boundaries.
///
/// Demotion: falling below 0 drops a division and lands at
/// DEMOTION_LANDING_LP. **A tier is never lost.** At division IV of any
/// tier, LP floors at 0 instead of demoting out. Tier is a high-water mark,
/// which suits a solo learning app: a bad week should not erase months.
export function applyLp(before: RankState, delta: number): Omit<LpOutcome, "bonus"> {
  const startTierIndex = tierIndex(before.tier);

  // Apex tiers: one unbounded pool, tier is a threshold on it. Never demotes
  // below Master once reached.
  if (isApexTier(before.tier)) {
    const lp = Math.max(0, before.lp + delta);
    const tier = apexTierForLp(lp);
    const after: RankState = { tier, division: null, lp };
    const moved = tierIndex(tier) - startTierIndex;
    return {
      delta,
      before,
      after,
      divisionsMoved: moved,
      change: moved > 0 ? "promoted" : moved < 0 ? "demoted" : null,
      tierPromoted: moved > 0,
    };
  }

  let tierIdx = startTierIndex;
  let division = before.division ?? 4;
  let lp = before.lp + delta;
  let divisionsMoved = 0;

  // Promote while LP overflows a division.
  while (lp >= LP_PER_DIVISION) {
    if (division > 1) {
      division -= 1;
      lp -= LP_PER_DIVISION;
      divisionsMoved += 1;
      continue;
    }
    // At division I: promote to the next tier.
    if (tierIdx >= RANK_TIERS.length - 1) {
      lp = LP_PER_DIVISION; // already Challenger, clamp
      break;
    }
    tierIdx += 1;
    lp -= LP_PER_DIVISION;
    divisionsMoved += 1;
    if (!hasDivisions(tierAt(tierIdx))) {
      // Entering Master+: LP becomes an unbounded pool starting from the
      // carried remainder.
      return {
        delta,
        before,
        after: { tier: apexTierForLp(lp), division: null, lp },
        divisionsMoved,
        change: "promoted",
        tierPromoted: true,
      };
    }
    division = 4;
  }

  // Demote while LP is negative, but never out of the tier.
  while (lp < 0) {
    if (division < 4) {
      division += 1;
      lp += LP_PER_DIVISION;
      // Land at a buffer rather than just under the boundary, so one good
      // session does not immediately bounce back.
      lp = Math.min(lp, DEMOTION_LANDING_LP);
      divisionsMoved -= 1;
      continue;
    }
    // Division IV: the tier floor. LP cannot go below zero here.
    lp = 0;
    break;
  }

  const afterTier = tierAt(tierIdx);
  const after: RankState = { tier: afterTier, division, lp };
  return {
    delta,
    before,
    after,
    divisionsMoved,
    change: divisionsMoved > 0 ? "promoted" : divisionsMoved < 0 ? "demoted" : null,
    tierPromoted: tierIndex(afterTier) > startTierIndex,
  };
}

/// End-to-end: session result -> new ladder position.
export function resolveSession(before: RankState, input: LpSessionInput): LpOutcome {
  const { delta, bonus } = lpDeltaFor(input);
  return { ...applyLp(before, delta), bonus };
}

/// The starting position for a new or reset account.
export function startingRank(): RankState {
  return { tier: "IRON", division: 4, lp: 0 };
}

/// True when `a` is a strictly higher ladder position than `b`. Compares
/// tier, then division (1 outranks 4), then LP. Used to maintain the peak
/// high-water mark.
export function outranks(a: RankState, b: RankState): boolean {
  const tierDelta = tierIndex(a.tier) - tierIndex(b.tier);
  if (tierDelta !== 0) return tierDelta > 0;

  // Null division (apex tiers) is treated as the top of its tier.
  const aDiv = a.division ?? 0;
  const bDiv = b.division ?? 0;
  if (aDiv !== bDiv) return aDiv < bDiv;

  return a.lp > b.lp;
}

/// Display helper: LP progress within the current division, as a fraction.
/// Apex tiers measure against the next threshold instead.
export function lpFraction(state: RankState): number {
  if (isApexTier(state.tier)) {
    if (state.tier === "CHALLENGER") return 1;
    const target = state.tier === "GRANDMASTER" ? CHALLENGER_LP : GRANDMASTER_LP;
    const floor = state.tier === "GRANDMASTER" ? GRANDMASTER_LP : 0;
    return Math.min(1, Math.max(0, (state.lp - floor) / (target - floor)));
  }
  return Math.min(1, Math.max(0, state.lp / LP_PER_DIVISION));
}

export type { Rank };
