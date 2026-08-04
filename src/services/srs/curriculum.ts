// Per-type curriculum level, derived from progress rather than stored. Each
// SubjectType (KANA, RADICAL, KANJI, VOCAB, SENTENCE, GRAMMAR — READING has
// no ladder) advances independently: "level N is complete" once >= 90% of
// that type's laddered subjects at level N have reached Guru (srsStage >= 5).
// This generalises the single 90%-kanji rule in unlock.ts's nextUserLevel to
// every laddered type. Pure and DB-free — see
// src/server/queries/curriculum.ts for the grouped-aggregate query that
// supplies the inputs.

export const CURRICULUM_ADVANCE_THRESHOLD = 0.9;

export interface LevelGuruStats {
  level: number;
  /// Laddered subjects of this type at this level.
  total: number;
  /// Of those, how many are at srsStage >= 5 (Guru or above).
  guruCount: number;
}

/// The current curriculum level for one type: 1 + the number of complete
/// levels below it, where "complete" means >= 90% Guru'd. Levels are walked
/// in order starting at 1; the first incomplete (or unseeded) level is where
/// the count stops. A type with no laddered content at all (empty `stats`)
/// is level 1 — nothing to have completed yet.
export function curriculumLevel(stats: LevelGuruStats[]): number {
  const byLevel = new Map(stats.map((s) => [s.level, s]));
  if (byLevel.size === 0) return 1;

  const maxLevel = Math.max(...byLevel.keys());
  let level = 1;
  for (let l = 1; l <= maxLevel; l++) {
    const stat = byLevel.get(l);
    if (!stat || stat.total === 0) break;
    const ratio = stat.guruCount / stat.total;
    if (ratio >= CURRICULUM_ADVANCE_THRESHOLD) {
      level = l + 1;
    } else {
      break;
    }
  }
  return level;
}
