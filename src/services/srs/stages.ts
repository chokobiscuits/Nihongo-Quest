// SRS stage table. Stage 0 is "not yet reviewed" (a lesson item); 1-9 mirror
// the WaniKani-style Apprentice -> Guru -> Master -> Enlightened -> Burned
// ladder. `intervalMs` is how long an item waits before it is due again after
// answering correctly at that *starting* stage; Burned never comes due again.

export const LESSON_STAGE = 0;
export const GURU_STAGE = 5;
export const MAX_STAGE = 9;
export const BURNED_STAGE = 9;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface StageInfo {
  stage: number;
  name: string;
  /// Time until next due date after a correct answer taken *from* this stage.
  /// Null for Burned: a burned item never comes due again.
  intervalMs: number | null;
}

export const STAGES: readonly StageInfo[] = [
  { stage: 0, name: "Lesson", intervalMs: 0 },
  { stage: 1, name: "Apprentice I", intervalMs: 4 * HOUR },
  { stage: 2, name: "Apprentice II", intervalMs: 8 * HOUR },
  { stage: 3, name: "Apprentice III", intervalMs: 1 * DAY },
  { stage: 4, name: "Apprentice IV", intervalMs: 2 * DAY },
  { stage: 5, name: "Guru I", intervalMs: 7 * DAY },
  { stage: 6, name: "Guru II", intervalMs: 14 * DAY },
  { stage: 7, name: "Master", intervalMs: 30 * DAY },
  { stage: 8, name: "Enlightened", intervalMs: 120 * DAY },
  { stage: 9, name: "Burned", intervalMs: null },
];

export function stageInfo(stage: number): StageInfo {
  const info = STAGES[stage];
  if (!info) {
    throw new Error(`Unknown SRS stage: ${stage}`);
  }
  return info;
}

/// The interval to wait, starting now, before an item that just moved *to*
/// `stage` comes due. This is the interval associated with the stage itself
/// (not the stage it came from) — i.e. how long an item spends at `stage`
/// before its next review.
export function intervalForStage(stage: number): number | null {
  return stageInfo(stage).intervalMs;
}

export function isBurned(stage: number): boolean {
  return stage >= BURNED_STAGE;
}

export function isGuruOrAbove(stage: number): boolean {
  return stage >= GURU_STAGE;
}
