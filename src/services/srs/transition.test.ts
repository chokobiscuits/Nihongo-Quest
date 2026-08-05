import { describe, expect, it } from "vitest";
import { computeTransition, isPromotionBlocked } from "./transition";

const NOW = new Date("2026-08-01T12:00:00.000Z");

describe("isPromotionBlocked", () => {
  it("is false when there is no prior promotion", () => {
    expect(isPromotionBlocked(null, NOW)).toBe(false);
  });

  it("is true within the 4-hour window", () => {
    const threeHoursAgo = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(isPromotionBlocked(threeHoursAgo, NOW)).toBe(true);
  });

  it("is false exactly at and after the 4-hour boundary", () => {
    const fourHoursAgo = new Date(NOW.getTime() - 4 * 60 * 60 * 1000);
    expect(isPromotionBlocked(fourHoursAgo, NOW)).toBe(false);
    const fiveHoursAgo = new Date(NOW.getTime() - 5 * 60 * 60 * 1000);
    expect(isPromotionBlocked(fiveHoursAgo, NOW)).toBe(false);
  });
});

describe("computeTransition: correct answers", () => {
  it("advances one stage", () => {
    const result = computeTransition({
      stage: 3,
      correct: true,
      incorrectCount: 0,
      now: NOW,
      lastPromotedAt: null,
    });
    expect(result.endedStage).toBe(4);
    expect(result.promoted).toBe(true);
    expect(result.lastPromotedAt).toEqual(NOW);
  });

  it("caps at stage 9 (Burned)", () => {
    const result = computeTransition({
      stage: 9,
      correct: true,
      incorrectCount: 0,
      now: NOW,
      lastPromotedAt: null,
    });
    expect(result.endedStage).toBe(9);
    expect(result.dueAt).toBeNull();
  });

  it("sets dueAt using the new stage's interval", () => {
    const result = computeTransition({
      stage: 4,
      correct: true,
      incorrectCount: 0,
      now: NOW,
      lastPromotedAt: null,
    });
    // stage 4 -> 5 (Guru I), interval 7 days
    expect(result.endedStage).toBe(5);
    expect(result.dueAt).toEqual(new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000));
  });

  it("blocks promotion within the 4-hour cooldown but still logs the answer", () => {
    const twoHoursAgo = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
    const result = computeTransition({
      stage: 3,
      correct: true,
      incorrectCount: 0,
      now: NOW,
      lastPromotedAt: twoHoursAgo,
    });
    expect(result.startedStage).toBe(3);
    expect(result.endedStage).toBe(3);
    expect(result.promoted).toBe(false);
    // lastPromotedAt is unchanged, not bumped, since nothing promoted.
    expect(result.lastPromotedAt).toEqual(twoHoursAgo);
    // dueAt is still computed off the (unchanged) current stage's interval:
    // stage 3 is Apprentice III, 1 day.
    expect(result.dueAt).toEqual(new Date(NOW.getTime() + 1 * 24 * 60 * 60 * 1000));
  });

  it("allows promotion once the cooldown has elapsed", () => {
    const fiveHoursAgo = new Date(NOW.getTime() - 5 * 60 * 60 * 1000);
    const result = computeTransition({
      stage: 3,
      correct: true,
      incorrectCount: 0,
      now: NOW,
      lastPromotedAt: fiveHoursAgo,
    });
    expect(result.endedStage).toBe(4);
    expect(result.promoted).toBe(true);
    expect(result.lastPromotedAt).toEqual(NOW);
  });
});

describe("computeTransition: incorrect answers", () => {
  it("still demotes even when within the promotion cooldown", () => {
    const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000);
    const result = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: oneHourAgo,
    });
    // stage 5 >= 5, penaltyFactor 2; incorrectAdjustment = ceil(1/2) = 1
    expect(result.endedStage).toBe(3);
    expect(result.promoted).toBe(false);
    // lastPromotedAt is untouched by a demotion.
    expect(result.lastPromotedAt).toEqual(oneHourAgo);
  });

  it("uses penaltyFactor 1 below Guru (stage 4) vs 2 at/above Guru (stage 5)", () => {
    const atStage4 = computeTransition({
      stage: 4,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
    });
    // incorrectAdjustment = 1, penaltyFactor = 1 -> 4 - 1 = 3
    expect(atStage4.endedStage).toBe(3);

    const atStage5 = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
    });
    // incorrectAdjustment = 1, penaltyFactor = 2 -> 5 - 2 = 3
    expect(atStage5.endedStage).toBe(3);

    const atStage5MoreWrong = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 3,
      now: NOW,
      lastPromotedAt: null,
    });
    // incorrectAdjustment = ceil(3/2) = 2, penaltyFactor = 2 -> 5 - 4 = 1
    expect(atStage5MoreWrong.endedStage).toBe(1);
  });

  it("never drops below stage 1", () => {
    const result = computeTransition({
      stage: 2,
      correct: false,
      incorrectCount: 10,
      now: NOW,
      lastPromotedAt: null,
    });
    expect(result.endedStage).toBe(1);
  });

  it("computes dueAt off the demoted stage's interval", () => {
    const result = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
    });
    // demoted to stage 3, interval 1 day
    expect(result.dueAt).toEqual(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));
  });
});

describe("computeTransition: mastery-softened demotion", () => {
  // Clean-climb baselines, one correct answer per stage below the current
  // one at masteryXpForAnswer(s) = 5 + 2s: stage 5 -> 45, stage 8 -> 96.
  const CLEAN_AT_5 = 45;
  const CLEAN_AT_8 = 96;

  it("halves the penalty at Guru for an item with a flawless history", () => {
    const result = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
      masteryXp: CLEAN_AT_5,
    });
    // ratio 1.0 <= 1.6, so penaltyFactor 1 -> 5 - 1 = 4, not 3.
    expect(result.endedStage).toBe(4);
  });

  it("keeps the full penalty for a chronically shaky item", () => {
    const result = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
      // A shaky item accumulates MORE mastery XP than a clean one, because
      // it keeps coming back. Ratio 132/45 = 2.93 > 1.6.
      masteryXp: 132,
    });
    expect(result.endedStage).toBe(3);
  });

  it("softens Enlightened, where the full penalty costs 120 days of interval", () => {
    const clean = computeTransition({
      stage: 8,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
      masteryXp: CLEAN_AT_8,
    });
    // Drops to Guru II (14 days) rather than Guru I (7 days).
    expect(clean.endedStage).toBe(7);

    const shaky = computeTransition({
      stage: 8,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
      masteryXp: CLEAN_AT_8 * 3,
    });
    expect(shaky.endedStage).toBe(6);
  });

  it("applies the full penalty at the ratio boundary and softens just under it", () => {
    const justOver = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
      masteryXp: Math.ceil(CLEAN_AT_5 * 1.6) + 1,
    });
    expect(justOver.endedStage).toBe(3);

    const atBoundary = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
      masteryXp: CLEAN_AT_5 * 1.6,
    });
    expect(atBoundary.endedStage).toBe(4);
  });

  it("does not soften below Guru, where the penalty is already 1", () => {
    const result = computeTransition({
      stage: 4,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
      masteryXp: 1000,
    });
    expect(result.endedStage).toBe(3);
  });

  it("falls back to the full Guru penalty when masteryXp is omitted", () => {
    const result = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 1,
      now: NOW,
      lastPromotedAt: null,
    });
    expect(result.endedStage).toBe(3);
  });

  it("still compounds with incorrectCount for a clean item", () => {
    const result = computeTransition({
      stage: 5,
      correct: false,
      incorrectCount: 3,
      now: NOW,
      lastPromotedAt: null,
      masteryXp: CLEAN_AT_5,
    });
    // incorrectAdjustment = ceil(3/2) = 2, penaltyFactor 1 -> 5 - 2 = 3.
    expect(result.endedStage).toBe(3);
  });
});
