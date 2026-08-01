const INCORRECT_ANSWER_XP = 2;

/// XP for one correct answer at a given SRS stage: higher stages are worth
/// more, since they are harder to earn and riskier to lose.
export function xpForCorrectAnswer(srsStage: number): number {
  return Math.round(10 * (1 + srsStage * 0.15));
}

export function xpForIncorrectAnswer(): number {
  return INCORRECT_ANSWER_XP;
}

/// Flat completion bonus for finishing a session, scaled by how many items
/// were in it.
export function sessionBonus(itemCount: number): number {
  return 20 + 2 * itemCount;
}

/// Multiplier applied to a session's total XP based on the user's current
/// daily streak. Capped at 1.5x (streakDays >= 25).
export function streakMultiplier(streakDays: number): number {
  return Math.min(1 + streakDays * 0.02, 1.5);
}

/// XP required to go from level L to level L+1.
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.6));
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
