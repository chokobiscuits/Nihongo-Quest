import { normalizeMeaning, normalizeReading, stripOkuriganaDot } from "./normalize";

export type QuestionKind = "MEANING" | "READING";

export interface MeaningEntry {
  meaning: string;
  primary: boolean;
}

export interface ReadingEntry {
  reading: string;
  primary: boolean;
  type?: string;
}

export interface GradableSubject {
  meanings: MeaningEntry[];
  readings: ReadingEntry[];
  /// User-authored synonym whitelist (Subject.acceptedMeanings).
  acceptedMeanings: string[];
}

export type GradeResult =
  | { result: "correct" }
  | { result: "incorrect" }
  /// Within edit distance 1 of an accepted meaning: prompt the user to
  /// retype rather than recording a pass or a fail.
  | { result: "almost" }
  /// The user answered a MEANING question with kana/an answer that matches a
  /// reading (or vice versa): prompt, do not record.
  | { result: "wrongType" };

/// Levenshtein edit distance, capped-computation-free (fine at these input
/// lengths — single words/short phrases).
function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }

  return d[rows - 1][cols - 1];
}

function meaningPool(subject: GradableSubject): string[] {
  return [...subject.meanings.map((m) => m.meaning), ...subject.acceptedMeanings];
}

/// Normalizes a stored reading for comparison: strips the okurigana dot
/// first (kanjidic readings like `た.べる` are still valid kana once the
/// separator is gone) and then runs it through the same kana normalization
/// as user input.
function normalizeStoredReading(reading: string): string {
  return normalizeReading(stripOkuriganaDot(reading));
}

function readingPool(subject: GradableSubject): string[] {
  return subject.readings.map((r) => r.reading);
}

/// Grades a MEANING answer: exact normalized match against `meanings` plus
/// `acceptedMeanings`, else an edit-distance-1 "almost", else incorrect. Also
/// detects a `wrongType` answer: typed kana that matches an accepted
/// reading, which suggests the user answered the wrong question.
export function gradeMeaning(rawAnswer: string, subject: GradableSubject): GradeResult {
  const answer = normalizeMeaning(rawAnswer);
  if (answer.length === 0) return { result: "incorrect" };

  const meanings = meaningPool(subject).map(normalizeMeaning);
  if (meanings.includes(answer)) return { result: "correct" };

  // wrongType: the raw (unnormalized) answer matches a reading once run
  // through the same reading-normalization path.
  const asReading = normalizeReading(rawAnswer);
  const readings = readingPool(subject).map(normalizeStoredReading);
  if (asReading.length > 0 && readings.includes(asReading)) {
    return { result: "wrongType" };
  }

  const almost = meanings.some((m) => levenshtein(answer, m) === 1);
  if (almost) return { result: "almost" };

  return { result: "incorrect" };
}

/// Grades a READING answer: converts romaji input to kana via wanakana, then
/// exact-matches against `readings` with okurigana dots stripped from both
/// sides (`た.べる` accepts `たべる`). Detects `wrongType` when the answer
/// instead matches an accepted meaning.
export function gradeReading(rawAnswer: string, subject: GradableSubject): GradeResult {
  const answer = normalizeReading(rawAnswer);
  if (answer.length === 0) return { result: "incorrect" };

  const readings = readingPool(subject).map(normalizeStoredReading);
  if (readings.includes(answer)) return { result: "correct" };

  const asMeaning = normalizeMeaning(rawAnswer);
  const meanings = meaningPool(subject).map(normalizeMeaning);
  if (meanings.includes(asMeaning)) {
    return { result: "wrongType" };
  }

  return { result: "incorrect" };
}

export function grade(questionKind: QuestionKind, rawAnswer: string, subject: GradableSubject): GradeResult {
  return questionKind === "MEANING" ? gradeMeaning(rawAnswer, subject) : gradeReading(rawAnswer, subject);
}
