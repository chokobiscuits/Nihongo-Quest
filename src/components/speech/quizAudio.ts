export interface QuizQuestionRef {
  kind: string;
  /// Identifies the item a question belongs to, in whatever id space the
  /// quiz uses; only compared against other refs from the same quiz.
  itemId: string;
}

/// Whether the quiz may play (or offer) an item's pronunciation after the
/// current answer. The audio is the item's kana reading, so playing it after
/// a MEANING answer would hand over the answer to that item's READING
/// question if one is still waiting in the session queue, including a
/// READING question re-queued after a wrong answer. Everything else is
/// already answered, or has no reading question, and is safe.
///
/// `rest` is every question still in the queue after `current`.
export function mayRevealPronunciation(current: QuizQuestionRef, rest: QuizQuestionRef[]): boolean {
  if (current.kind !== "MEANING") return true;
  return !rest.some((q) => q.kind === "READING" && q.itemId === current.itemId);
}
