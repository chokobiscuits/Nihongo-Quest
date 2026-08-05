// Pure review-performance stats. Given a flat list of ReviewLog rows, this
// computes accuracy split by question type and an accuracy trend over time
// so the UI can answer "how am I doing" without touching the database.

/// A review log entry counts as "correct" when its incorrectCount is 0
/// (the answer was accepted on the first try); any incorrectCount > 0 counts
/// as one incorrect answer for accuracy purposes, regardless of how many
/// mistakes were made getting there.
export interface AccuracySplit {
  questionType: "MEANING" | "READING";
  correct: number;
  incorrect: number;
  /// 0-100, rounded to one decimal. 0 when there are no answers at all.
  accuracyPct: number;
}

export interface AccuracyTrendPoint {
  /// UTC date, midnight, one point per day with any activity.
  date: Date;
  correct: number;
  incorrect: number;
  accuracyPct: number;
}

/// Which logs to score. "ranked" (the default) counts only real SRS reviews;
/// "all" also folds in unranked practice. See buildReviewStats.
export type ReviewStatsMode = "ranked" | "all";

export interface ReviewStatsInput {
  logs: {
    questionType: "MEANING" | "READING";
    incorrectCount: number;
    startedStage: number;
    endedStage: number;
    answeredAt: Date;
  }[];
  mode?: ReviewStatsMode;
}

export interface ReviewStats {
  split: AccuracySplit[]; // one entry per question type, always both
  trend: AccuracyTrendPoint[]; // ascending by date
  /// Answers actually scored, after `mode` filtering.
  totalAnswers: number;
  overallAccuracyPct: number;
  /// Which mode produced the numbers above.
  mode: ReviewStatsMode;
  /// Counts over the FULL input regardless of mode, so a caller can tell how
  /// much was excluded. rankedAnswers + practiceAnswers is the input size.
  rankedAnswers: number;
  practiceAnswers: number;
}

const QUESTION_TYPES: readonly ("MEANING" | "READING")[] = ["MEANING", "READING"];

/// 0-100, rounded to one decimal, 0 when correct + incorrect is 0.
function accuracyPct(correct: number, incorrect: number): number {
  const total = correct + incorrect;
  if (total === 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

/// UTC calendar day for `date`, at midnight.
function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/// True for a log written by unranked practice rather than a ranked review.
///
/// Practice commits deliberately never move an item's SRS stage (see
/// commitUnrankedReviewSession in src/server/actions/reviews.ts), so it writes
/// its rows with startedStage === endedStage. A ranked review can also leave
/// the stage unchanged when the 4-hour promotion cap blocks a correct answer,
/// so this predicate slightly over-counts practice. It is the only signal
/// ReviewLog carries, and the alternative is mixing two modes with different
/// meanings into one accuracy number.
export function isPracticeLog(log: { startedStage: number; endedStage: number }): boolean {
  return log.startedStage === log.endedStage;
}

/// Builds accuracy split-by-type and daily trend from raw review logs.
///
/// `mode` selects which logs are scored. This matters because unranked
/// practice is unbounded and re-servable: the same items can be drilled all
/// day, so folding practice into one accuracy number lets volume on easy
/// items paper over ranked performance. Default is "ranked", which is the
/// number that reflects real SRS progress. "all" preserves the previous
/// mixed behavior for callers that genuinely want it, and the returned
/// `rankedAnswers` / `practiceAnswers` counts always describe the full input
/// so a caller can see what was excluded.
///
/// Tolerates an empty `logs` array: returns both split entries zeroed, an
/// empty trend, and 0 totals. Never divides by zero.
export function buildReviewStats(input: ReviewStatsInput): ReviewStats {
  const { logs, mode = "ranked" } = input;

  // Counted over the whole input, before any mode filtering, so the caller
  // can always tell how much data the chosen mode left out.
  let rankedAnswers = 0;
  let practiceAnswers = 0;
  for (const log of logs) {
    if (isPracticeLog(log)) practiceAnswers += 1;
    else rankedAnswers += 1;
  }

  const scored = mode === "all" ? logs : logs.filter((log) => !isPracticeLog(log));

  const splitCounts = new Map<"MEANING" | "READING", { correct: number; incorrect: number }>();
  for (const type of QUESTION_TYPES) splitCounts.set(type, { correct: 0, incorrect: 0 });

  const trendCounts = new Map<number, { date: Date; correct: number; incorrect: number }>();

  let totalCorrect = 0;
  let totalIncorrect = 0;

  for (const log of scored) {
    const correct = log.incorrectCount === 0;

    const bucket = splitCounts.get(log.questionType)!;
    if (correct) bucket.correct += 1;
    else bucket.incorrect += 1;

    const day = utcDay(log.answeredAt);
    const dayKey = day.getTime();
    const trendBucket = trendCounts.get(dayKey) ?? { date: day, correct: 0, incorrect: 0 };
    if (correct) trendBucket.correct += 1;
    else trendBucket.incorrect += 1;
    trendCounts.set(dayKey, trendBucket);

    if (correct) totalCorrect += 1;
    else totalIncorrect += 1;
  }

  const split: AccuracySplit[] = QUESTION_TYPES.map((type) => {
    const counts = splitCounts.get(type)!;
    return {
      questionType: type,
      correct: counts.correct,
      incorrect: counts.incorrect,
      accuracyPct: accuracyPct(counts.correct, counts.incorrect),
    };
  });

  const trend: AccuracyTrendPoint[] = Array.from(trendCounts.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((point) => ({
      date: point.date,
      correct: point.correct,
      incorrect: point.incorrect,
      accuracyPct: accuracyPct(point.correct, point.incorrect),
    }));

  return {
    split,
    trend,
    totalAnswers: totalCorrect + totalIncorrect,
    overallAccuracyPct: accuracyPct(totalCorrect, totalIncorrect),
    mode,
    rankedAnswers,
    practiceAnswers,
  };
}
