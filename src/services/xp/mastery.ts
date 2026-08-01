const MASTERY_XP_PER_CORRECT = 10;

/// Mastery XP awarded for one correct answer. Unlike SRS XP, this never
/// decreases and has no incorrect-answer counterpart — it tracks cumulative
/// familiarity with an item, not current recall confidence.
export function masteryXpForCorrectAnswer(): number {
  return MASTERY_XP_PER_CORRECT;
}

/// masteryLevel = floor(sqrt(masteryXp / 25)). Unbounded: there is no cap on
/// how mastered an item can become.
export function masteryLevelFromXp(masteryXp: number): number {
  return Math.floor(Math.sqrt(masteryXp / 25));
}
