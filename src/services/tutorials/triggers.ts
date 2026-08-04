import type { TutorialSubjectType, TutorialTrigger } from "./trigger-types";

/// Plain stats snapshot a trigger is evaluated against. Pure — no DB access
/// here; src/server/queries/tutorials.ts is responsible for turning live
/// UserProfile/UserSubject rows into this shape.
export interface TutorialStats {
  accountLevel: number;
  /// Per-type counts of UserSubject rows that have been started (lesson
  /// taken), passed (srsStage reached passedAt), or burned (srsStage burned).
  startedByType: Record<TutorialSubjectType, number>;
  passedByType: Record<TutorialSubjectType, number>;
  burnedByType: Record<TutorialSubjectType, number>;
  /// True if any started VOCAB subject is built from 2+ distinct KANJI
  /// components (a multi-kanji word), regardless of type.
  hasMultiKanjiWordStarted: boolean;
  /// True once at least one tutorial (any tutorial) has ever been completed
  /// by this user. Used by `first_launch` so it only fires before anything
  /// else has been acknowledged.
  hasCompletedAnyTutorial: boolean;
}

/// Pure predicate: is `trigger` currently satisfied against `stats`? Zero DB
/// access, zero side effects — every trigger kind's condition lives here and
/// only here, so it can be unit-tested without a database.
export function isTriggered(trigger: TutorialTrigger, stats: TutorialStats): boolean {
  switch (trigger.kind) {
    case "first_launch":
      return !stats.hasCompletedAnyTutorial;

    case "before_first":
      return stats.startedByType[trigger.subjectType] === 0;

    case "account_level":
      return stats.accountLevel >= trigger.level;

    case "first_guru":
      return anyPassed(stats.passedByType);

    case "first_burn":
      return anyBurned(stats.burnedByType);

    case "first_multi_kanji_word":
      return stats.hasMultiKanjiWordStarted;

    case "manual":
      // Never auto-triggers; only reachable via the /tutorials library.
      return false;

    default: {
      const _exhaustive: never = trigger;
      return _exhaustive;
    }
  }
}

function anyPassed(passedByType: Record<TutorialSubjectType, number>): boolean {
  return Object.values(passedByType).some((n) => n > 0);
}

function anyBurned(burnedByType: Record<TutorialSubjectType, number>): boolean {
  return Object.values(burnedByType).some((n) => n > 0);
}
