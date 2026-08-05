/// Flat XP awarded for learning a brand-new item (lesson, stage 0 -> 1).
/// Learning is the highest-value act in the app — it is the one action that
/// always grows the user's total item count — so it is a flat reward rather
/// than stage-scaled (a lesson item has no prior stage to scale from).
export const LESSON_XP = 25;

/// Base XP for a review answered correctly, before stage scaling.
export const REVIEW_CORRECT_BASE_XP = 8;
/// Per-stage XP bonus for a review answered correctly: higher stages are
/// worth more, since they are harder to earn and riskier to lose.
export const REVIEW_CORRECT_PER_STAGE_XP = 3;

/// Flat XP for an incorrect answer — a small participation reward, not tied
/// to stage.
export const INCORRECT_ANSWER_XP = 2;

/// Multiplier applied to a review answer that earned no stage progress,
/// i.e. the 4-hour promotion cooldown blocked the promotion (see
/// src/services/srs/transition.ts). Without this, the cooldown itself would
/// be exploitable: the ranked queue filters by dueAt and empties normally,
/// but an item at the cooldown boundary could re-enter the unranked practice
/// queue indefinitely. Scaling unproductive reviews down to a token amount
/// removes the incentive to cycle between the two.
export const UNPRODUCTIVE_REVIEW_XP_FACTOR = 0.1;

/// Unranked practice XP. Practice is deliberately worth far less than a
/// ranked review and is capped per day.
///
/// The reason is structural: getUnrankedReviewQueue has no `dueAt` filter
/// (that is the whole point — you can drill anything, any time), so the same
/// items are re-servable indefinitely. A per-answer award with no ceiling
/// would therefore be farmable without limit. The cap is the load-bearing
/// defence and is absolute regardless of how many items are re-served; the
/// low per-answer rate and the absence of a streak multiplier are secondary.
export const UNRANKED_XP_PER_CORRECT = 1;
export const UNRANKED_DAILY_XP_CAP = 150;

/// XP for one correct unranked practice answer, before the daily cap is
/// applied by the caller.
export function xpForPracticeAnswer(): number {
  return UNRANKED_XP_PER_CORRECT;
}

/// Clamps a practice session's raw XP to what remains of today's cap.
/// Returns 0 once the cap is spent.
export function capPracticeXp(rawXp: number, alreadyEarnedToday: number): number {
  const remaining = UNRANKED_DAILY_XP_CAP - alreadyEarnedToday;
  return Math.max(0, Math.min(rawXp, remaining));
}

/// Streak multiplier growth rate: +2% per consecutive day active.
export const STREAK_MULTIPLIER_PER_DAY = 0.02;
/// Streak multiplier cap, reached at 25 days (1 + 25 * 0.02 = 1.5).
export const STREAK_MULTIPLIER_CAP = 1.5;

/// XP for learning a new item in a lesson (stage 0 -> 1). Flat, not
/// stage-scaled — see LESSON_XP.
export function xpForLesson(): number {
  return LESSON_XP;
}

/// XP for one correct review answer at a given SRS stage: higher stages are
/// worth more, since they are harder to earn and riskier to lose.
export function xpForCorrectAnswer(srsStage: number): number {
  return Math.round(REVIEW_CORRECT_BASE_XP + srsStage * REVIEW_CORRECT_PER_STAGE_XP);
}

export function xpForIncorrectAnswer(): number {
  return INCORRECT_ANSWER_XP;
}

/// Scales a review answer's XP by whether the review actually advanced the
/// item. `productive` is the transition's `promoted` flag: false means the
/// cooldown blocked the stage move, so the answer earns a heavily reduced
/// share. Always floors at 1 XP for a correct answer, so a blocked review is
/// worth something but never worth farming.
///
/// Incorrect answers are not scaled: they already pay a flat token amount,
/// and reducing them further would push toward zero for genuine mistakes.
export function scaleXpForProductivity(xp: number, productive: boolean): number {
  if (productive) return xp;
  return Math.max(1, Math.round(xp * UNPRODUCTIVE_REVIEW_XP_FACTOR));
}

/// Multiplier applied to a session's total XP based on the user's current
/// daily streak. Capped at STREAK_MULTIPLIER_CAP (streakDays >= 25).
export function streakMultiplier(streakDays: number): number {
  return Math.min(1 + streakDays * STREAK_MULTIPLIER_PER_DAY, STREAK_MULTIPLIER_CAP);
}

// Level cost curve. Levels are unbounded and deliberately do NOT hard-scale:
// cost is a flat base plus a *sublinear* term, so the per-level price rises
// but its rate of rise decays. There is no cap, no inflection point and no
// wall — level 1000 is a long grind, never an impossibility.
//
// The shape is chosen so one solid session is roughly one level early on and
// still a meaningful fraction of a level much later. Against a modest day
// (~685 XP: a 5-item lesson batch plus 20 reviews) that is ~1.7 levels at
// L1, ~0.9 at L50 and ~0.25 at L500.
//
// The previous curve was quadratic to L24 then linear, which had the
// opposite problem at both ends: level 10 arrived in under two weeks while
// level 100 needed 1.9M XP and was effectively unreachable.
export const LEVEL_COST_BASE = 400;
export const LEVEL_COST_K = 12;
export const LEVEL_COST_P = 0.85;

/// XP required to go from level L to level L+1. Defined for every L >= 1;
/// there is no maximum level.
export function xpForLevel(level: number): number {
  return Math.round(LEVEL_COST_BASE + LEVEL_COST_K * Math.pow(level, LEVEL_COST_P));
}

// Prefix sums of xpForLevel, extended lazily. PREFIX[i] is the total XP
// needed to reach level i+1, so PREFIX[0] === 0 (level 1 costs nothing to
// reach). Cached because levels are unbounded now: the old implementation
// re-summed from level 1 on every call and levelFromTotalXp called it in a
// loop, making the pair O(n^2) in the level. That was survivable with a
// hard cap and is not without one.
const PREFIX: number[] = [0];

function extendPrefixTo(level: number): void {
  for (let l = PREFIX.length; l < level; l++) {
    // PREFIX[l] = PREFIX[l-1] + cost of level l (1-indexed levels).
    PREFIX[l] = PREFIX[l - 1] + xpForLevel(l);
  }
}

/// Total XP needed to reach level L from level 1, i.e. the sum of
/// xpForLevel(1..L-1). totalXpToReach(1) === 0.
export function totalXpToReach(level: number): number {
  if (level <= 1) return 0;
  extendPrefixTo(level);
  return PREFIX[level - 1];
}

/// Inverse of totalXpToReach: the highest level whose XP requirement has
/// been fully met by `totalXp`. Binary search over the cached prefix sums.
export function levelFromTotalXp(totalXp: number): number {
  if (totalXp <= 0) return 1;

  // Grow the cache by doubling until it covers totalXp, then binary search
  // it. Doubling keeps this O(log n) amortised rather than walking level by
  // level.
  let hi = Math.max(2, PREFIX.length);
  extendPrefixTo(hi);
  while (PREFIX[hi - 1] <= totalXp) {
    hi *= 2;
    extendPrefixTo(hi);
  }

  // PREFIX[i] is the cost to reach level i+1; find the largest i with
  // PREFIX[i] <= totalXp.
  let lo = 0;
  let best = 0;
  let high = hi - 1;
  while (lo <= high) {
    const mid = (lo + high) >>> 1;
    if (PREFIX[mid] <= totalXp) {
      best = mid;
      lo = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best + 1;
}
