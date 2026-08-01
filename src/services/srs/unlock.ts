import { GURU_STAGE } from "./stages";

export interface ComponentProgress {
  childId: string;
  srsStage: number | null; // null = no UserSubject row yet, i.e. not started
}

export interface SubjectWithComponents {
  id: string;
  type: "RADICAL" | "KANJI" | "VOCAB" | "GRAMMAR" | "SENTENCE" | "READING";
  level: number;
  components: ComponentProgress[];
}

/// A Subject unlocks once every one of its components has been Guru'd
/// (srsStage >= 5). An item with no components (most radicals) is
/// vacuously unlocked by this rule alone — radicals are additionally gated
/// by user level below.
export function componentsSatisfied(components: ComponentProgress[]): boolean {
  return components.every((c) => (c.srsStage ?? 0) >= GURU_STAGE);
}

/// Whether `subject` should be unlocked for a user at `userLevel` given the
/// current SRS state of its components.
///
/// Radicals unlock purely on level (they have no components to gate them,
/// and level is what introduces their level's new radicals). Everything else
/// unlocks once its components are all Guru'd, subject to also being at or
/// below the user's current level.
export function isSubjectUnlocked(subject: SubjectWithComponents, userLevel: number): boolean {
  if (subject.level > userLevel) return false;

  if (subject.type === "RADICAL") {
    return true;
  }

  return componentsSatisfied(subject.components);
}

export interface LevelKanjiProgress {
  srsStage: number | null;
}

/// User level advances once 90% of the current level's kanji have reached
/// Guru (srsStage >= 5). Returns the new level (unchanged if the threshold
/// isn't met, or if there is nothing to grade).
export function nextUserLevel(currentLevel: number, levelKanji: LevelKanjiProgress[]): number {
  if (levelKanji.length === 0) return currentLevel;

  const guruCount = levelKanji.filter((k) => (k.srsStage ?? 0) >= GURU_STAGE).length;
  const ratio = guruCount / levelKanji.length;

  return ratio >= 0.9 ? currentLevel + 1 : currentLevel;
}
