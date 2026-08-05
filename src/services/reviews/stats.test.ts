import { describe, expect, it } from "vitest";
import { buildReviewStats } from "./stats";

function log(overrides: {
  questionType?: "MEANING" | "READING";
  incorrectCount?: number;
  startedStage?: number;
  endedStage?: number;
  answeredAt?: Date;
}) {
  return {
    questionType: overrides.questionType ?? "MEANING",
    incorrectCount: overrides.incorrectCount ?? 0,
    startedStage: overrides.startedStage ?? 1,
    endedStage: overrides.endedStage ?? 2,
    answeredAt: overrides.answeredAt ?? new Date("2026-08-05T12:00:00.000Z"),
  };
}

describe("buildReviewStats", () => {
  it("returns both split entries zeroed, empty trend, and 0 totals for empty input", () => {
    const stats = buildReviewStats({ logs: [] });

    expect(stats.split).toHaveLength(2);
    expect(stats.split.map((s) => s.questionType).sort()).toEqual(["MEANING", "READING"]);
    for (const entry of stats.split) {
      expect(entry.correct).toBe(0);
      expect(entry.incorrect).toBe(0);
      expect(entry.accuracyPct).toBe(0);
    }
    expect(stats.trend).toEqual([]);
    expect(stats.totalAnswers).toBe(0);
    expect(stats.overallAccuracyPct).toBe(0);
  });

  it("includes both split entries even when only one question type has data", () => {
    const stats = buildReviewStats({
      logs: [log({ questionType: "MEANING", incorrectCount: 0 }), log({ questionType: "MEANING", incorrectCount: 1 })],
    });

    const meaning = stats.split.find((s) => s.questionType === "MEANING")!;
    const reading = stats.split.find((s) => s.questionType === "READING")!;

    expect(meaning.correct).toBe(1);
    expect(meaning.incorrect).toBe(1);
    expect(meaning.accuracyPct).toBe(50);

    expect(reading.correct).toBe(0);
    expect(reading.incorrect).toBe(0);
    expect(reading.accuracyPct).toBe(0);
  });

  it("computes accuracy math, rounded to one decimal, without dividing by zero", () => {
    const stats = buildReviewStats({
      logs: [
        log({ questionType: "READING", incorrectCount: 0 }),
        log({ questionType: "READING", incorrectCount: 0 }),
        log({ questionType: "READING", incorrectCount: 2 }),
      ],
    });

    const reading = stats.split.find((s) => s.questionType === "READING")!;
    expect(reading.correct).toBe(2);
    expect(reading.incorrect).toBe(1);
    // 2/3 = 66.666...% -> rounded to one decimal
    expect(reading.accuracyPct).toBe(66.7);
    expect(stats.totalAnswers).toBe(3);
    expect(stats.overallAccuracyPct).toBe(66.7);
  });

  it("treats any incorrectCount > 0 as a single incorrect answer, correct only at 0", () => {
    const stats = buildReviewStats({
      logs: [log({ incorrectCount: 0 }), log({ incorrectCount: 1 }), log({ incorrectCount: 5 })],
    });

    const meaning = stats.split.find((s) => s.questionType === "MEANING")!;
    expect(meaning.correct).toBe(1);
    expect(meaning.incorrect).toBe(2);
  });

  it("groups trend entries by UTC calendar day, across day boundaries", () => {
    const stats = buildReviewStats({
      logs: [
        log({ answeredAt: new Date("2026-08-05T00:00:00.000Z"), incorrectCount: 0 }),
        log({ answeredAt: new Date("2026-08-05T23:59:59.999Z"), incorrectCount: 1 }),
        log({ answeredAt: new Date("2026-08-06T00:00:00.000Z"), incorrectCount: 0 }),
      ],
    });

    expect(stats.trend).toHaveLength(2);
    const [day1, day2] = stats.trend;
    expect(day1.date.toISOString()).toBe("2026-08-05T00:00:00.000Z");
    expect(day1.correct).toBe(1);
    expect(day1.incorrect).toBe(1);
    expect(day2.date.toISOString()).toBe("2026-08-06T00:00:00.000Z");
    expect(day2.correct).toBe(1);
    expect(day2.incorrect).toBe(0);
  });

  it("returns trend points in ascending date order regardless of input order", () => {
    const stats = buildReviewStats({
      logs: [
        log({ answeredAt: new Date("2026-08-07T10:00:00.000Z") }),
        log({ answeredAt: new Date("2026-08-05T10:00:00.000Z") }),
        log({ answeredAt: new Date("2026-08-06T10:00:00.000Z") }),
      ],
    });

    expect(stats.trend.map((p) => p.date.toISOString())).toEqual([
      "2026-08-05T00:00:00.000Z",
      "2026-08-06T00:00:00.000Z",
      "2026-08-07T00:00:00.000Z",
    ]);
  });

  it("excludes unranked practice from scoring by default", () => {
    // Practice writes startedStage === endedStage. Here every practice answer
    // is wrong and every ranked answer is right, so mixing the two modes
    // would be unmissable in the accuracy number.
    const stats = buildReviewStats({
      logs: [
        log({ startedStage: 1, endedStage: 2, incorrectCount: 0 }),
        log({ startedStage: 3, endedStage: 3, incorrectCount: 2 }),
        log({ startedStage: 3, endedStage: 3, incorrectCount: 1 }),
      ],
    });

    expect(stats.mode).toBe("ranked");
    expect(stats.totalAnswers).toBe(1);
    expect(stats.overallAccuracyPct).toBe(100);
  });

  it("reports ranked and practice counts over the full input regardless of mode", () => {
    const logs = [
      log({ startedStage: 1, endedStage: 2 }),
      log({ startedStage: 3, endedStage: 3 }),
      log({ startedStage: 4, endedStage: 4 }),
    ];

    const ranked = buildReviewStats({ logs });
    expect(ranked.rankedAnswers).toBe(1);
    expect(ranked.practiceAnswers).toBe(2);
    expect(ranked.rankedAnswers + ranked.practiceAnswers).toBe(logs.length);

    // The counts describe the input, so they do not move when mode changes.
    const all = buildReviewStats({ logs, mode: "all" });
    expect(all.rankedAnswers).toBe(1);
    expect(all.practiceAnswers).toBe(2);
  });

  it('scores practice alongside ranked when mode is "all"', () => {
    const stats = buildReviewStats({
      logs: [
        log({ startedStage: 1, endedStage: 2, incorrectCount: 0 }),
        log({ startedStage: 3, endedStage: 3, incorrectCount: 1 }),
      ],
      mode: "all",
    });

    expect(stats.mode).toBe("all");
    expect(stats.totalAnswers).toBe(2);
    expect(stats.overallAccuracyPct).toBe(50);
  });

  it("excludes practice from the trend, not just the totals", () => {
    const stats = buildReviewStats({
      logs: [
        log({ startedStage: 1, endedStage: 2, answeredAt: new Date("2026-08-05T10:00:00.000Z") }),
        log({ startedStage: 3, endedStage: 3, answeredAt: new Date("2026-08-06T10:00:00.000Z") }),
      ],
    });

    expect(stats.trend).toHaveLength(1);
    expect(stats.trend[0].date.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("returns zeroed output when every log is practice and mode is ranked", () => {
    const stats = buildReviewStats({
      logs: [log({ startedStage: 2, endedStage: 2 }), log({ startedStage: 5, endedStage: 5 })],
    });

    expect(stats.totalAnswers).toBe(0);
    expect(stats.overallAccuracyPct).toBe(0);
    expect(stats.trend).toEqual([]);
    expect(stats.split).toHaveLength(2);
    expect(stats.practiceAnswers).toBe(2);
  });
});
