import { describe, expect, it } from "vitest";
import {
  masteryLevelFromXp,
  masteryXpForAnswer,
  accountMasteryLevel,
  masteryTier,
  masteryProgress,
  ACCOUNT_MASTERY_DIVISOR,
  MASTERY_XP_BASE,
  MASTERY_XP_PER_STAGE,
} from "./mastery";

describe("masteryXpForAnswer", () => {
  it("scales with SRS stage: 5 + stage * 2", () => {
    expect(MASTERY_XP_BASE).toBe(5);
    expect(MASTERY_XP_PER_STAGE).toBe(2);
    expect(masteryXpForAnswer(1)).toBe(7); // Apprentice I
    expect(masteryXpForAnswer(8)).toBe(21); // Enlightened
  });
});

describe("masteryLevelFromXp", () => {
  it("is floor(sqrt(xp / 25))", () => {
    expect(masteryLevelFromXp(0)).toBe(0);
    expect(masteryLevelFromXp(24)).toBe(0);
    expect(masteryLevelFromXp(25)).toBe(1);
    expect(masteryLevelFromXp(624)).toBe(4); // sqrt(24.96) = 4.99...
    expect(masteryLevelFromXp(625)).toBe(5); // sqrt(25) = 5
    expect(masteryLevelFromXp(2499)).toBe(9); // sqrt(99.96) = 9.99...
    expect(masteryLevelFromXp(2500)).toBe(10); // sqrt(100) = 10
  });

  it("is unbounded above", () => {
    expect(masteryLevelFromXp(250000)).toBe(100);
  });
});

describe("accountMasteryLevel", () => {
  it("is floor(sqrt(xp / 250))", () => {
    expect(ACCOUNT_MASTERY_DIVISOR).toBe(250);
    expect(accountMasteryLevel(0)).toBe(0);
    expect(accountMasteryLevel(249)).toBe(0);
    expect(accountMasteryLevel(250)).toBe(1);
    expect(accountMasteryLevel(999)).toBe(1); // sqrt(3.996) = 1.99...
    expect(accountMasteryLevel(1000)).toBe(2); // sqrt(4) = 2
    expect(accountMasteryLevel(2249)).toBe(2); // sqrt(8.996) = 2.99...
    expect(accountMasteryLevel(2250)).toBe(3); // sqrt(9) = 3
  });

  it("level 0 with nothing learned", () => {
    expect(accountMasteryLevel(0)).toBe(0);
  });

  it("is unbounded above", () => {
    expect(accountMasteryLevel(2500000)).toBe(100);
  });

  it("is monotonic non-decreasing as xp increases", () => {
    let previous = accountMasteryLevel(0);
    for (let xp = 0; xp <= 50000; xp += 137) {
      const level = accountMasteryLevel(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});

describe("masteryTier", () => {
  it("level 0 is Unranked", () => {
    const tier = masteryTier(0);
    expect(tier.name).toBe("Unranked");
    expect(tier.level).toBe(0);
  });

  it("maps levels 1-5 to their named tiers", () => {
    expect(masteryTier(1).name).toBe("Novice");
    expect(masteryTier(2).name).toBe("Apprentice");
    expect(masteryTier(3).name).toBe("Practitioner");
    expect(masteryTier(4).name).toBe("Adept");
    expect(masteryTier(5).name).toBe("Proficient");
  });

  it("bands 6-9 Expert, 10-14 Master, 15-24 Sage, 25+ Transcendent", () => {
    expect(masteryTier(6).name).toBe("Expert");
    expect(masteryTier(9).name).toBe("Expert");
    expect(masteryTier(10).name).toBe("Master");
    expect(masteryTier(14).name).toBe("Master");
    expect(masteryTier(15).name).toBe("Sage");
    expect(masteryTier(24).name).toBe("Sage");
    expect(masteryTier(25).name).toBe("Transcendent");
    expect(masteryTier(1000).name).toBe("Transcendent");
  });

  it("level keeps climbing past Transcendent while the name stays terminal", () => {
    expect(masteryTier(25).level).toBe(25);
    expect(masteryTier(500).level).toBe(500);
  });
});

describe("masteryProgress", () => {
  it("level 0 with 0 xp", () => {
    const progress = masteryProgress(0);
    expect(progress.level).toBe(0);
    expect(progress.xpIntoLevel).toBe(0);
    expect(progress.xpForNextLevel).toBe(250);
  });

  it("mid-level progress", () => {
    const progress = masteryProgress(1200);
    expect(progress.level).toBe(2); // floor(sqrt(4.8)) = 2
    expect(progress.xpIntoLevel).toBe(1200 - 1000);
    expect(progress.xpForNextLevel).toBe(2250 - 1000);
  });

  it("exact level threshold has zero xpIntoLevel", () => {
    const progress = masteryProgress(1000);
    expect(progress.level).toBe(2);
    expect(progress.xpIntoLevel).toBe(0);
  });
});
