import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, type AchievementStats } from "./definitions";

const ZERO_STATS: AchievementStats = {
  itemsLearned: 0,
  radicalsLearned: 0,
  kanjiLearned: 0,
  vocabLearned: 0,
  radicalsTotal: 214,
  guruOrAboveCount: 0,
  masterOrAboveCount: 0,
  burnedCount: 0,
  currentStreak: 0,
  accountLevel: 1,
  rankTier: "IRON",
  accountMasteryLevel: 0,
  bestSessionAccuracyPct: 0,
  largestSessionItemCount: 0,
};

/// A stats object with generous values for every axis, so every achievement's
/// progress function can be driven to (or past) its target from one fixture.
const MAX_STATS: AchievementStats = {
  itemsLearned: 10000,
  radicalsLearned: 214,
  kanjiLearned: 5000,
  vocabLearned: 10000,
  radicalsTotal: 214,
  guruOrAboveCount: 10000,
  masterOrAboveCount: 10000,
  burnedCount: 10000,
  currentStreak: 1000,
  accountLevel: 100,
  rankTier: "CHALLENGER",
  accountMasteryLevel: 100,
  bestSessionAccuracyPct: 100,
  largestSessionItemCount: 500,
};

describe("ACHIEVEMENTS", () => {
  it("has unique ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ACHIEVEMENTS.map((a) => [a.id, a] as const))(
    "%s: progress(zero) is at its minimum (0, or 1 for level achievements — account level starts at 1)",
    (_id, achievement) => {
      const expected = achievement.id.startsWith("level-") ? 1 : 0;
      expect(achievement.progress(ZERO_STATS)).toBe(expected);
    },
  );

  it.each(ACHIEVEMENTS.map((a) => [a.id, a] as const))(
    "%s: progress(max) reaches or exceeds target",
    (_id, achievement) => {
      expect(achievement.progress(MAX_STATS)).toBeGreaterThanOrEqual(achievement.target);
    },
  );

  it("first-item is partially unlocked with one item learned", () => {
    const achievement = ACHIEVEMENTS.find((a) => a.id === "first-item")!;
    const stats: AchievementStats = { ...ZERO_STATS, itemsLearned: 1 };
    expect(achievement.progress(stats)).toBe(1);
    expect(achievement.progress(stats)).toBeGreaterThanOrEqual(achievement.target);
  });

  it("kanji-100 reports partial progress below target", () => {
    const achievement = ACHIEVEMENTS.find((a) => a.id === "kanji-100")!;
    const stats: AchievementStats = { ...ZERO_STATS, kanjiLearned: 42 };
    expect(achievement.progress(stats)).toBe(42);
    expect(achievement.progress(stats)).toBeLessThan(achievement.target);
  });

  it("rank achievements only unlock at or above the required tier", () => {
    const silver = ACHIEVEMENTS.find((a) => a.id === "rank-silver")!;
    expect(silver.progress({ ...ZERO_STATS, rankTier: "BRONZE" })).toBe(0);
    expect(silver.progress({ ...ZERO_STATS, rankTier: "SILVER" })).toBe(1);
    expect(silver.progress({ ...ZERO_STATS, rankTier: "DIAMOND" })).toBe(1);
  });

  it("streak-30 reports partial progress mid-streak", () => {
    const achievement = ACHIEVEMENTS.find((a) => a.id === "streak-30")!;
    const stats: AchievementStats = { ...ZERO_STATS, currentStreak: 15 };
    expect(achievement.progress(stats)).toBe(15);
    expect(achievement.progress(stats)).toBeLessThan(achievement.target);
  });
});
