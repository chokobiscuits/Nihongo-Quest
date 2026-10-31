import { describe, expect, it, vi } from "vitest";

const findManyUserProfile = vi.fn();
const findManyDailyActivity = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    userProfile: { findMany: (...args: unknown[]) => findManyUserProfile(...args) },
    dailyActivity: { findMany: (...args: unknown[]) => findManyDailyActivity(...args) },
  },
}));

vi.mock("@/lib/storage", () => ({
  storage: { publicUrl: (p: string) => `https://cdn.test/${p}` },
}));

const { getLeaderboard } = await import("./leaderboard");

// A Wednesday, so "this week" is Monday-to-Wednesday inclusive.
const NOW = new Date("2026-10-21T12:00:00.000Z");
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

function profile(overrides: Partial<Parameters<typeof baseProfile>[0]> = {}) {
  return baseProfile(overrides);
}

function baseProfile(overrides: {
  userId?: string;
  displayName?: string;
  avatarPath?: string | null;
  totalXp?: bigint;
  currentStreak?: number;
  lastActiveDay?: Date | null;
  timezone?: string;
}) {
  return {
    userId: "u1",
    displayName: "Alice",
    avatarPath: null,
    totalXp: 0n,
    currentStreak: 0,
    lastActiveDay: null,
    timezone: "UTC",
    ...overrides,
  };
}

describe("getLeaderboard", () => {
  it("ranks by total XP, converting BigInt to Number", async () => {
    findManyUserProfile.mockResolvedValue([
      profile({ userId: "a", displayName: "Alice", totalXp: 500n }),
      profile({ userId: "b", displayName: "Bob", totalXp: 1500n }),
    ]);
    findManyDailyActivity.mockResolvedValue([]);

    const result = await getLeaderboard("a", NOW);

    expect(result.total.map((r) => [r.userId, r.rank, r.value])).toEqual([
      ["b", 1, 1500],
      ["a", 2, 500],
    ]);
    expect(typeof result.total[0].value).toBe("number");
  });

  it("sums weekly XP only for days in the Monday-anchored week, per user's own timezone", async () => {
    findManyUserProfile.mockResolvedValue([profile({ userId: "a", timezone: "UTC" })]);
    findManyDailyActivity.mockResolvedValue([
      { userId: "a", day: day(2026, 9, 19), xpEarned: 100 }, // Monday this week
      { userId: "a", day: day(2026, 9, 21), xpEarned: 50 }, // Wednesday (today)
      { userId: "a", day: day(2026, 9, 18), xpEarned: 999 }, // last Sunday, excluded
    ]);

    const result = await getLeaderboard("a", NOW);

    expect(result.weekly[0].value).toBe(150);
  });

  it("applies shared-rank tie-breaking across tabs", async () => {
    findManyUserProfile.mockResolvedValue([
      profile({ userId: "a", displayName: "Aiko", totalXp: 100n }),
      profile({ userId: "b", displayName: "Bo", totalXp: 100n }),
      profile({ userId: "c", displayName: "Cy", totalXp: 50n }),
    ]);
    findManyDailyActivity.mockResolvedValue([]);

    const result = await getLeaderboard("a", NOW);

    expect(result.total.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("displays a stale streak as 0 when lastActiveDay is before yesterday", async () => {
    findManyUserProfile.mockResolvedValue([
      profile({ userId: "a", currentStreak: 10, lastActiveDay: day(2026, 9, 10), timezone: "UTC" }),
      profile({ userId: "b", currentStreak: 5, lastActiveDay: day(2026, 9, 20), timezone: "UTC" }), // yesterday
    ]);
    findManyDailyActivity.mockResolvedValue([]);

    const result = await getLeaderboard("a", NOW);

    const byUser = new Map(result.streak.map((r) => [r.userId, r.value]));
    expect(byUser.get("a")).toBe(0);
    expect(byUser.get("b")).toBe(5);
  });

  it("excludes users with no UserProfile row without crashing", async () => {
    findManyUserProfile.mockResolvedValue([profile({ userId: "a" })]);
    findManyDailyActivity.mockResolvedValue([]);

    const result = await getLeaderboard("a", NOW);

    expect(result.total).toHaveLength(1);
    expect(result.total[0].userId).toBe("a");
  });

  it("resolves avatarUrl from avatarPath via storage.publicUrl", async () => {
    findManyUserProfile.mockResolvedValue([profile({ userId: "a", avatarPath: "a/avatar.png" })]);
    findManyDailyActivity.mockResolvedValue([]);

    const result = await getLeaderboard("a", NOW);

    expect(result.total[0].avatarUrl).toBe("https://cdn.test/a/avatar.png");
  });
});
