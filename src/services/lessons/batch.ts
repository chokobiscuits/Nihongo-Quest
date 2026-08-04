// Pure lesson batch ordering. The DB query (src/server/queries/lessons.ts)
// gathers candidate subjects that are already known to be unlocked and not
// yet started; this module only decides the order they are presented in and
// truncates to the requested batch size.

export type LessonSubjectType = "KANA" | "RADICAL" | "KANJI" | "VOCAB" | "GRAMMAR" | "SENTENCE" | "READING";

export interface LessonCandidate {
  id: string;
  type: LessonSubjectType;
  level: number | null;
  /// Lower sorts first. Null (no frequency data) sorts after every ranked
  /// item, since an unranked item has no claim to being taught earlier.
  frequency: number | null;
}

const TYPE_ORDER: Record<LessonSubjectType, number> = {
  KANA: 0,
  RADICAL: 1,
  KANJI: 2,
  VOCAB: 3,
  GRAMMAR: 4,
  SENTENCE: 5,
  READING: 6,
};

/// Kana before radicals before kanji before vocab (and other types after,
/// though lessons only schedule the curriculum ladder today), then by level
/// (nulls last — off-ladder items never reach this list in practice, but the
/// ordering stays total), then by frequency (rarer/unranked last).
export function compareLessonCandidates(a: LessonCandidate, b: LessonCandidate): number {
  const typeDelta = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  if (typeDelta !== 0) return typeDelta;

  const aLevel = a.level ?? Infinity;
  const bLevel = b.level ?? Infinity;
  if (aLevel !== bLevel) return aLevel - bLevel;

  const aFreq = a.frequency ?? Infinity;
  const bFreq = b.frequency ?? Infinity;
  if (aFreq !== bFreq) return aFreq - bFreq;

  return a.id.localeCompare(b.id);
}

export const DEFAULT_LESSON_BATCH_SIZE = 5;

/// Orders and truncates a pool of already-unlocked, not-yet-started subjects
/// into the next lesson batch.
export function selectLessonBatch<T extends LessonCandidate>(
  candidates: T[],
  batchSize: number = DEFAULT_LESSON_BATCH_SIZE,
): T[] {
  return [...candidates].sort(compareLessonCandidates).slice(0, Math.max(0, batchSize));
}
