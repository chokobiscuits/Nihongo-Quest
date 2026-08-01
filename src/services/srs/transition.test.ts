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
