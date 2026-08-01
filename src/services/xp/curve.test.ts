import { describe, expect, it } from "vitest";
import {
  levelFromTotalXp,
  sessionBonus,
  streakMultiplier,
  totalXpToReach,
  xpForCorrectAnswer,
  xpForIncorrectAnswer,
  xpForLevel,
} from "./curve";

describe("xpForCorrectAnswer", () => {
  it("scales with SRS stage", () => {
    expect(xpForCorrectAnswer(0)).toBe(10); // round(10 * 1)
    expect(xpForCorrectAnswer(5)).toBe(18); // round(10 * 1.75)
    // round(10 * 2.35) === 23 due to floating point (10 * 2.35 evaluates to
    // 23.499999999999996, just under the .5 rounding boundary).
    expect(xpForCorrectAnswer(9)).toBe(23);
  });
});

describe("xpForIncorrectAnswer", () => {
  it("is a flat 2 xp", () => {
    expect(xpForIncorrectAnswer()).toBe(2);
  });
});

describe("sessionBonus", () => {
  it("is 20 + 2 per item", () => {
    expect(sessionBonus(0)).toBe(20);
    expect(sessionBonus(10)).toBe(40);
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
  it("matches round(100 * L^1.6)", () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(Math.round(100 * Math.pow(2, 1.6)));
    expect(xpForLevel(10)).toBe(Math.round(100 * Math.pow(10, 1.6)));
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
    for (let level = 1; level <= 50; level++) {
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
});
