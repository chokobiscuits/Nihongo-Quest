import { describe, expect, it } from "vitest";
import { applyDailyActivity } from "./streak";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

describe("applyDailyActivity", () => {
  it("starts a streak at 1 on first-ever activity", () => {
    const result = applyDailyActivity({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDay: null,
      today: day(1),
    });
    expect(result).toEqual({ currentStreak: 1, longestStreak: 1, lastActiveDay: day(1) });
  });

  it("is a no-op for a second activity on the same day", () => {
    const result = applyDailyActivity({
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDay: day(1),
      today: day(1),
    });
    expect(result).toEqual({ currentStreak: 3, longestStreak: 5, lastActiveDay: day(1) });
  });

  it("extends the streak on the very next day", () => {
    const result = applyDailyActivity({
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDay: day(1),
      today: day(2),
    });
    expect(result).toEqual({ currentStreak: 4, longestStreak: 5, lastActiveDay: day(2) });
  });

  it("resets to 1 after a gap", () => {
    const result = applyDailyActivity({
      currentStreak: 6,
      longestStreak: 6,
      lastActiveDay: day(1),
      today: day(4),
    });
    expect(result).toEqual({ currentStreak: 1, longestStreak: 6, lastActiveDay: day(4) });
  });

  it("grows longestStreak when the new streak exceeds it", () => {
    const result = applyDailyActivity({
      currentStreak: 5,
      longestStreak: 5,
      lastActiveDay: day(1),
      today: day(2),
    });
    expect(result.longestStreak).toBe(6);
  });
});
