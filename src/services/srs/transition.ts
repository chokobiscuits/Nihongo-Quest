import { MAX_STAGE, intervalForStage } from "./stages";
import { masteryXpForAnswer } from "../xp/mastery";

const PROMOTION_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

/// Efficiency ratio at or below which a miss costs only one stage, even at
/// Guru and above. See `demotionPenaltyFactor` for what the ratio measures.
/// An item that reached its stage in close to the minimum number of correct
/// answers sits near 1.0; one that needed roughly half again as many sits
/// near 1.5.
export const CLEAN_HISTORY_RATIO = 1.6;

export interface TransitionInput {
  stage: number;
  correct: boolean;
  /// Number of wrong sub-answers within this single review (e.g. typo
  /// retries). 0 or 1 for a clean pass.
  incorrectCount: number;
  now: Date;
  lastPromotedAt: Date | null;
  /// The item's accumulated mastery XP, used to soften the demotion penalty
  /// for items with a clean history. Optional: omitting it falls back to the
  /// stage-only penalty, which is what callers that don't track mastery get.
  masteryXp?: number;
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

/// The mastery XP an item would hold if it had climbed to `stage` without a
/// single miss: one correct answer at each stage below it. This is the
/// minimum possible mastery XP for an item sitting at that stage, so it is
/// the baseline a real item's history is measured against.
function cleanClimbMasteryXp(stage: number): number {
  let total = 0;
  for (let s = 0; s < stage; s += 1) total += masteryXpForAnswer(s);
  return total;
}

/// How much a miss costs, as a multiplier on the stage drop.
///
/// The Guru doubling exists because losing long-term-review status should
/// cost more than losing a fresh Apprentice item. But applying it to every
/// item punishes a well-learned one for a single bad morning: at Enlightened
/// that is 120 days of interval erased.
///
/// So the doubling is waived for items with a clean history. "Clean" is
/// measured as `masteryXp / cleanClimbMasteryXp(stage)`: how much mastery the
/// item has actually accumulated versus the minimum needed to reach its
/// current stage. A flawless item sits at exactly 1.0. One that was missed
/// once early sits near 1.5. One that has bounced between stages for a dozen
/// reviews sits near 3.0.
///
/// Note the ratio, not raw `masteryXp`, is what carries the signal. Raw
/// mastery XP rises with *volume*, and a struggling item accumulates more of
/// it than a clean one precisely because it keeps coming back: a shaky item
/// at Guru I can hold 132 XP against a flawless item's 45. Comparing against
/// the clean-climb baseline is what turns that into a usable measure.
function demotionPenaltyFactor(stage: number, masteryXp: number | undefined): number {
  if (stage < 5) return 1;
  if (masteryXp === undefined) return 2;
  const baseline = cleanClimbMasteryXp(stage);
  if (baseline <= 0) return 2;
  return masteryXp / baseline <= CLEAN_HISTORY_RATIO ? 1 : 2;
}

/// Stage delta for an incorrect answer: bigger misses hurt more, and higher
/// stages hurt more unless the item's own history earns it the softer
/// penalty (see `demotionPenaltyFactor`).
function demotedStage(stage: number, incorrectCount: number, masteryXp: number | undefined): number {
  const incorrectAdjustment = Math.ceil(incorrectCount / 2);
  const penaltyFactor = demotionPenaltyFactor(stage, masteryXp);
  return Math.max(1, stage - incorrectAdjustment * penaltyFactor);
}

export function computeTransition(input: TransitionInput): TransitionResult {
  const { stage, correct, incorrectCount, now, lastPromotedAt, masteryXp } = input;

  if (!correct) {
    const endedStage = demotedStage(stage, incorrectCount, masteryXp);
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
