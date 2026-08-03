// Pure review-session question generation. The DB query
// (src/server/queries/reviews.ts) gathers reviewable subjects (already
// ordered by dueAt); this module only decides what questions each item
// generates and how they're interleaved.

export type ReviewQuestionKind = "MEANING" | "READING";

export interface ReviewCandidate {
  /// UserSubject id — questions and re-queue tracking key off this, not the
  /// subject id, since a subject only ever has one UserSubject per user.
  userSubjectId: string;
  subjectType: "RADICAL" | "KANJI" | "VOCAB" | "GRAMMAR" | "SENTENCE" | "READING";
}

export interface ReviewQuestion {
  userSubjectId: string;
  kind: ReviewQuestionKind;
}

/// Which question kinds an item needs: RADICAL and SENTENCE are
/// meaning-only. A sentence already displays its furigana on the question
/// card (see ReviewQuiz/LessonTeachCard), so a reading recall question would
/// just be re-typing text that's visibly annotated on screen — the useful
/// recall check for a sentence is translating it to English. Everything
/// else (KANJI, VOCAB, and off-ladder types that reach a review queue) needs
/// both meaning and reading before it can resolve.
export function questionKindsFor(subjectType: ReviewCandidate["subjectType"]): ReviewQuestionKind[] {
  return subjectType === "RADICAL" || subjectType === "SENTENCE" ? ["MEANING"] : ["MEANING", "READING"];
}

/// Builds the full question list for a batch of reviewable items, one entry
/// per required question kind, then interleaves so that an item's MEANING
/// and READING questions are never adjacent — the reading shouldn't be
/// primed by having just answered the meaning. Interleaving is a round-robin
/// across items in their given order: round 0 takes each item's first
/// question in turn, round 1 takes each item's second (if it has one), and
/// so on. With more than one item this guarantees no two consecutive
/// questions share an item, since a round only revisits an item after every
/// other item still in play has gone first.
export function buildReviewQueue(candidates: ReviewCandidate[]): ReviewQuestion[] {
  const perItem: ReviewQuestion[][] = candidates.map((candidate) =>
    questionKindsFor(candidate.subjectType).map((kind) => ({ userSubjectId: candidate.userSubjectId, kind })),
  );

  const interleaved: ReviewQuestion[] = [];
  const maxRounds = Math.max(0, ...perItem.map((q) => q.length));
  for (let round = 0; round < maxRounds; round++) {
    for (const questions of perItem) {
      if (round < questions.length) interleaved.push(questions[round]);
    }
  }

  return interleaved;
}

export interface ItemResolutionState {
  userSubjectId: string;
  /// Question kinds still outstanding for this item (removed as each is
  /// answered correctly).
  remainingKinds: Set<ReviewQuestionKind>;
  incorrectCount: number;
}

/// Builds the initial per-item resolution tracker for a batch, used by the
/// session runner to know when an item has had every required kind answered
/// correctly (and so is ready for its SRS transition).
export function buildResolutionState(candidates: ReviewCandidate[]): Map<string, ItemResolutionState> {
  const map = new Map<string, ItemResolutionState>();
  for (const candidate of candidates) {
    map.set(candidate.userSubjectId, {
      userSubjectId: candidate.userSubjectId,
      remainingKinds: new Set(questionKindsFor(candidate.subjectType)),
      incorrectCount: 0,
    });
  }
  return map;
}
