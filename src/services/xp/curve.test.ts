import { describe, expect, it } from "vitest";
import {
  levelFromTotalXp,
  streakMultiplier,
  totalXpToReach,
  xpForCorrectAnswer,
  xpForIncorrectAnswer,
  xpForLesson,
  xpForLevel,
  LESSON_XP,
  REVIEW_CORRECT_BASE_XP,
  REVIEW_CORRECT_PER_STAGE_XP,
  LEVEL_COST_K,
  LEVEL_COST_P,
  LEVEL_COST_INFLECTION,
  LEVEL_COST_FLOOR,
} from "./curve";

describe("xpForLesson", () => {
  it("is a flat 25 xp", () => {
    expect(xpForLesson()).toBe(LESSON_XP);
    expect(xpForLesson()).toBe(25);
  });
});

describe("xpForCorrectAnswer", () => {
  it("scales with SRS stage: 8 + stage * 3", () => {
    expect(REVIEW_CORRECT_BASE_XP).toBe(8);
    expect(REVIEW_CORRECT_PER_STAGE_XP).toBe(3);
    expect(xpForCorrectAnswer(0)).toBe(8);
    expect(xpForCorrectAnswer(1)).toBe(11); // Apprentice I
    expect(xpForCorrectAnswer(8)).toBe(32); // Enlightened
    expect(xpForCorrectAnswer(9)).toBe(35); // Burned
  });
});

describe("xpForIncorrectAnswer", () => {
  it("is a flat 2 xp", () => {
    expect(xpForIncorrectAnswer()).toBe(2);
  });
});

describe("streakMultiplier", () => {
  it("grows 2% per streak day", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(10)).toBeCloseTo(1.2);
  });

  it("caps at 1.5x", () => {
    expect(streakMultiplier(25)).toBe(1.5);
    expect(streakMultiplier(100)).toBe(1.5);
  });
});

describe("xpForLevel", () => {
  it("matches the piecewise cost curve constants", () => {
    expect(LEVEL_COST_K).toBe(95);
    expect(LEVEL_COST_P).toBe(1.38);
    expect(LEVEL_COST_INFLECTION).toBe(24);
    expect(LEVEL_COST_FLOOR).toBe(160);
  });

  it("never costs less than the floor", () => {
    for (let level = 1; level <= 150; level++) {
      expect(xpForLevel(level)).toBeGreaterThanOrEqual(LEVEL_COST_FLOOR);
    }
  });

  it("is quadratic-ish (Math.round(K * L^P)) up to the inflection point, floored", () => {
    expect(xpForLevel(1)).toBe(Math.max(LEVEL_COST_FLOOR, Math.round(95 * Math.pow(1, 1.38))));
    expect(xpForLevel(10)).toBe(Math.max(LEVEL_COST_FLOOR, Math.round(95 * Math.pow(10, 1.38))));
    expect(xpForLevel(24)).toBe(Math.max(LEVEL_COST_FLOOR, Math.round(95 * Math.pow(24, 1.38))));
  });

  it("is linear past the inflection point, continuing the tangent slope", () => {
    const atInflection = 95 * Math.pow(24, 1.38);
    const slope = 95 * 1.38 * Math.pow(24, 0.38);
    expect(xpForLevel(25)).toBe(Math.max(LEVEL_COST_FLOOR, Math.round(atInflection + slope * 1)));
    expect(xpForLevel(50)).toBe(Math.max(LEVEL_COST_FLOOR, Math.round(atInflection + slope * 26)));
  });

  it("is monotonically non-decreasing", () => {
    let previous = 0;
    for (let level = 1; level <= 200; level++) {
      const cost = xpForLevel(level);
      expect(cost).toBeGreaterThanOrEqual(previous);
      previous = cost;
    }
  });
});

describe("totalXpToReach", () => {
  it("is 0 at level 1", () => {
    expect(totalXpToReach(1)).toBe(0);
  });

  it("sums xpForLevel(1..L-1)", () => {
    expect(totalXpToReach(3)).toBe(xpForLevel(1) + xpForLevel(2));
  });
});

describe("levelFromTotalXp", () => {
  it("round-trips against totalXpToReach across a range of levels", () => {
    for (let level = 1; level <= 150; level++) {
      const xpAtLevel = totalXpToReach(level);
      expect(levelFromTotalXp(xpAtLevel)).toBe(level);

      // One xp short of the next level should still report the current level.
      const xpJustBelowNext = totalXpToReach(level + 1) - 1;
      expect(levelFromTotalXp(xpJustBelowNext)).toBe(level);
    }
  });

  it("is level 1 at zero xp", () => {
    expect(levelFromTotalXp(0)).toBe(1);
  });

  it("local-user's 353 xp still resolves to level 2 (no migration regression)", () => {
    expect(levelFromTotalXp(353)).toBe(2);
  });
});
