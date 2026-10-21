import { describe, expect, it } from "vitest";
import { rankLeaderboard, type LeaderboardCandidate } from "./rank";

function candidate(overrides: Partial<LeaderboardCandidate>): LeaderboardCandidate {
  return {
    userId: "u",
    displayName: "User",
    avatarUrl: null,
    value: 0,
    totalXp: 0,
    ...overrides,
  };
}

describe("rankLeaderboard", () => {
  it("ranks strictly descending values 1, 2, 3", () => {
    const result = rankLeaderboard([
      candidate({ userId: "a", value: 100 }),
      candidate({ userId: "b", value: 300 }),
      candidate({ userId: "c", value: 200 }),
    ]);
    expect(result.map((r) => [r.userId, r.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("gives tied values a shared rank, and skips the next integer (1,1,3)", () => {
    const result = rankLeaderboard([
      candidate({ userId: "a", displayName: "Aiko", value: 100, totalXp: 100 }),
      candidate({ userId: "b", displayName: "Bo", value: 100, totalXp: 100 }),
      candidate({ userId: "c", value: 50 }),
    ]);
    expect(result.map((r) => [r.userId, r.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ]);
  });

  it("orders ties by totalXp desc, then displayName asc, without affecting rank", () => {
    const result = rankLeaderboard([
      candidate({ userId: "a", displayName: "Zed", value: 10, totalXp: 50 }),
      candidate({ userId: "b", displayName: "Ann", value: 10, totalXp: 100 }),
      candidate({ userId: "c", displayName: "Ann", value: 10, totalXp: 50 }),
    ]);
    expect(result.map((r) => r.userId)).toEqual(["b", "c", "a"]);
    expect(result.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("handles a single candidate", () => {
    const result = rankLeaderboard([candidate({ userId: "a", value: 42 })]);
    expect(result).toEqual([{ ...candidate({ userId: "a", value: 42 }), rank: 1 }]);
  });

  it("handles an empty list", () => {
    expect(rankLeaderboard([])).toEqual([]);
  });
});
