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

/// Multiplier applied to a session's total XP based on the user's current
/// daily streak. Capped at STREAK_MULTIPLIER_CAP (streakDays >= 25).
export function streakMultiplier(streakDays: number): number {
  return Math.min(1 + streakDays * STREAK_MULTIPLIER_PER_DAY, STREAK_MULTIPLIER_CAP);
}

// Level cost curve: quadratic-ish early (levels 1..INFLECTION), linear after
// the inflection point (matching the tangent slope at INFLECTION so the
// curve has no kink), with a floor so no level ever costs less than roughly
// one session's worth of XP.
export const LEVEL_COST_K = 95;
export const LEVEL_COST_P = 1.38;
export const LEVEL_COST_INFLECTION = 24;
export const LEVEL_COST_FLOOR = 160;

/// XP required to go from level L to level L+1.
export function xpForLevel(level: number): number {
  if (level <= LEVEL_COST_INFLECTION) {
    return Math.max(LEVEL_COST_FLOOR, Math.round(LEVEL_COST_K * Math.pow(level, LEVEL_COST_P)));
  }
  const atInflection = LEVEL_COST_K * Math.pow(LEVEL_COST_INFLECTION, LEVEL_COST_P);
  const slopeAtInflection = LEVEL_COST_K * LEVEL_COST_P * Math.pow(LEVEL_COST_INFLECTION, LEVEL_COST_P - 1);
  const cost = atInflection + slopeAtInflection * (level - LEVEL_COST_INFLECTION);
  return Math.max(LEVEL_COST_FLOOR, Math.round(cost));
}

/// Total XP needed to reach level L from level 1, i.e. the sum of
/// xpForLevel(1..L-1). totalXpToReach(1) === 0.
export function totalXpToReach(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpForLevel(l);
  }
  return total;
}

/// Inverse of totalXpToReach: the highest level whose XP requirement has
/// been fully met by `totalXp`.
export function levelFromTotalXp(totalXp: number): number {
  let level = 1;
  // totalXpToReach grows, so a linear walk is fine at these level counts;
  // switch to a closed-form/binary search first if this ever needs to run
  // hot over very high levels.
  while (totalXpToReach(level + 1) <= totalXp) {
    level += 1;
  }
  return level;
}
