import { MAX_STAGE, intervalForStage } from "./stages";

const PROMOTION_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface TransitionInput {
  stage: number;
  correct: boolean;
  /// Number of wrong sub-answers within this single review (e.g. typo
  /// retries). 0 or 1 for a clean pass.
  incorrectCount: number;
  now: Date;
  lastPromotedAt: Date | null;
}

export interface TransitionResult {
  startedStage: number;
  endedStage: number;
  dueAt: Date | null;
  /// Whether this transition actually moved the item up a stage. False for
  /// every incorrect answer, and false for a would-be-correct promotion that
  /// the cooldown blocked.
  promoted: boolean;
  /// The lastPromotedAt to persist: unchanged unless `promoted` is true.
  lastPromotedAt: Date | null;
}

/// True when `lastPromotedAt` is within the 4-hour cooldown window as of
/// `now`. While blocked, an item cannot advance a stage on a correct answer —
/// but it still logs the review, still earns XP, and can still be demoted by
/// an incorrect answer. Only the upward move is suppressed.
export function isPromotionBlocked(lastPromotedAt: Date | null, now: Date): boolean {
  if (!lastPromotedAt) return false;
  return now.getTime() - lastPromotedAt.getTime() < PROMOTION_COOLDOWN_MS;
}

/// Stage delta for an incorrect answer: bigger misses and higher stages both
/// hurt more. `penaltyFactor` doubles the drop once an item has reached Guru
/// (stage >= 5), since losing long-term-review status should cost more than
/// losing a fresh Apprentice item.
function demotedStage(stage: number, incorrectCount: number): number {
  const incorrectAdjustment = Math.ceil(incorrectCount / 2);
  const penaltyFactor = stage >= 5 ? 2 : 1;
  return Math.max(1, stage - incorrectAdjustment * penaltyFactor);
}

export function computeTransition(input: TransitionInput): TransitionResult {
  const { stage, correct, incorrectCount, now, lastPromotedAt } = input;

  if (!correct) {
    const endedStage = demotedStage(stage, incorrectCount);
    const interval = intervalForStage(endedStage);
    return {
      startedStage: stage,
      endedStage,
      dueAt: interval === null ? null : new Date(now.getTime() + interval),
      promoted: false,
      lastPromotedAt,
    };
  }

  const blocked = isPromotionBlocked(lastPromotedAt, now);
  const endedStage = blocked ? stage : Math.min(MAX_STAGE, stage + 1);
  const promoted = endedStage > stage;
  const interval = intervalForStage(endedStage);

  return {
    startedStage: stage,
    endedStage,
    dueAt: interval === null ? null : new Date(now.getTime() + interval),
    promoted,
    lastPromotedAt: promoted ? now : lastPromotedAt,
  };
}
