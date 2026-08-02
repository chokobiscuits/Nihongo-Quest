import { describe, expect, it } from "vitest";
import { applyDailyActivity, dayInTimezone } from "./streak";

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

describe("dayInTimezone", () => {
  it("returns the UTC calendar date for the UTC timezone", () => {
    const now = new Date(Date.UTC(2026, 0, 15, 3, 0, 0));
    expect(dayInTimezone(now, "UTC")).toEqual(day(15));
  });

  it("rolls over to the next day in a timezone ahead of UTC (Asia/Tokyo, UTC+9)", () => {
    // 2026-01-14T15:30:00Z is 2026-01-15T00:30 JST — already the next day
    // in Tokyo even though it's still the 14th in UTC. This is the case
    // that was silently mishandled before dayInTimezone existed: naively
    // taking now.getUTCDate() would log this activity against the 14th.
    const now = new Date(Date.UTC(2026, 0, 14, 15, 30, 0));
    expect(dayInTimezone(now, "Asia/Tokyo")).toEqual(day(15));
    expect(dayInTimezone(now, "UTC")).toEqual(day(14));
  });

  it("does not yet roll over just before local midnight (Asia/Tokyo)", () => {
    // 2026-01-14T14:30:00Z is 2026-01-14T23:30 JST — still the 14th.
    const now = new Date(Date.UTC(2026, 0, 14, 14, 30, 0));
    expect(dayInTimezone(now, "Asia/Tokyo")).toEqual(day(14));
  });

  it("handles a timezone behind UTC (America/New_York, UTC-5 in January)", () => {
    // 2026-01-15T02:00:00Z is 2026-01-14T21:00 EST — still the 14th locally.
    const now = new Date(Date.UTC(2026, 0, 15, 2, 0, 0));
    expect(dayInTimezone(now, "America/New_York")).toEqual(day(14));
  });
});
