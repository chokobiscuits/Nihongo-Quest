import { describe, expect, it } from "vitest";
import {
  levelFromTotalXp,
  scaleXpForProductivity,
  streakMultiplier,
  totalXpToReach,
  xpForCorrectAnswer,
  xpForIncorrectAnswer,
  xpForLesson,
  xpForLevel,
  LESSON_XP,
  REVIEW_CORRECT_BASE_XP,
  REVIEW_CORRECT_PER_STAGE_XP,
  LEVEL_COST_BASE,
  LEVEL_COST_K,
  LEVEL_COST_P,
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
  it("matches the cost curve constants", () => {
    expect(LEVEL_COST_BASE).toBe(400);
    expect(LEVEL_COST_K).toBe(12);
    expect(LEVEL_COST_P).toBe(0.85);
  });

  it("is base + K * L^P", () => {
    expect(xpForLevel(1)).toBe(Math.round(400 + 12 * Math.pow(1, 0.85)));
    expect(xpForLevel(10)).toBe(Math.round(400 + 12 * Math.pow(10, 0.85)));
    expect(xpForLevel(500)).toBe(Math.round(400 + 12 * Math.pow(500, 0.85)));
  });

  // Pinned table: retuning the curve should be a visible, deliberate diff
  // rather than a silent drift in pacing.
  it("costs a pinned amount at representative levels", () => {
    expect(xpForLevel(1)).toBe(412);
    expect(xpForLevel(10)).toBe(485);
    expect(xpForLevel(50)).toBe(734);
    expect(xpForLevel(100)).toBe(1001);
    expect(xpForLevel(500)).toBe(2762);
  });

  it("is monotonically non-decreasing", () => {
    let previous = 0;
    for (let level = 1; level <= 2000; level++) {
      const cost = xpForLevel(level);
      expect(cost).toBeGreaterThanOrEqual(previous);
      previous = cost;
    }
  });

  // The defining property of "no hard scaling": each level costs more than
  // the last, but by a *shrinking* amount, so the curve never walls off.
  it("has a decaying growth rate (sublinear, never a wall)", () => {
    const delta = (l: number) => xpForLevel(l + 1) - xpForLevel(l);
    expect(delta(100)).toBeLessThan(delta(10));
    expect(delta(1000)).toBeLessThan(delta(100));
  });

  it("keeps very high levels reachable", () => {
    // A level should never cost more than a few days of solid play.
    // ~2925 XP is an active day; level 1000 must stay under a week of that.
    expect(xpForLevel(1000)).toBeLessThan(2925 * 7);
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

  it("resolves partial progress to the level actually paid for", () => {
    // 412 XP buys exactly level 2 (xpForLevel(1) === 412); one short does not.
    expect(levelFromTotalXp(411)).toBe(1);
    expect(levelFromTotalXp(412)).toBe(2);
  });

  it("handles very large totals without walking level by level", () => {
    // Guards the prefix-sum/binary-search implementation: the old linear
    // walk was O(n^2) and would crawl here. Levels are unbounded now.
    const deep = totalXpToReach(5000);
    expect(levelFromTotalXp(deep)).toBe(5000);
    expect(levelFromTotalXp(deep - 1)).toBe(4999);
  });

  it("is monotonic in totalXp", () => {
    let previous = 1;
    for (let xp = 0; xp < 200_000; xp += 997) {
      const level = levelFromTotalXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});

describe("scaleXpForProductivity", () => {
  it("leaves a productive review's xp untouched", () => {
    expect(scaleXpForProductivity(32, true)).toBe(32);
    expect(scaleXpForProductivity(11, true)).toBe(11);
  });

  it("heavily reduces xp when the cooldown blocked the promotion", () => {
    // Enlightened (stage 8) pays 32 xp productively, ~3 when farmed.
    expect(scaleXpForProductivity(32, false)).toBe(3);
    expect(scaleXpForProductivity(11, false)).toBe(1);
  });

  it("never drops below 1 xp, so a blocked review still registers", () => {
    expect(scaleXpForProductivity(1, false)).toBe(1);
    expect(scaleXpForProductivity(2, false)).toBe(1);
  });

  it("makes farming strictly worse than waiting out the cooldown", () => {
    for (let stage = 1; stage <= 8; stage++) {
      const productive = xpForCorrectAnswer(stage);
      const farmed = scaleXpForProductivity(productive, false);
      expect(farmed).toBeLessThan(productive);
    }
  });
});
