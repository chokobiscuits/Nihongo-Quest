import { describe, expect, it } from "vitest";
import { rankForLevel } from "./rank";

describe("rankForLevel: tier boundaries", () => {
  it("Iron 1-4", () => {
    expect(rankForLevel(1).tier).toBe("IRON");
    expect(rankForLevel(4).tier).toBe("IRON");
    expect(rankForLevel(5).tier).toBe("BRONZE");
  });

  it("Bronze 5-12", () => {
    expect(rankForLevel(5).tier).toBe("BRONZE");
    expect(rankForLevel(12).tier).toBe("BRONZE");
    expect(rankForLevel(13).tier).toBe("SILVER");
  });

  it("Silver 13-22", () => {
    expect(rankForLevel(13).tier).toBe("SILVER");
    expect(rankForLevel(22).tier).toBe("SILVER");
    expect(rankForLevel(23).tier).toBe("GOLD");
  });

  it("Gold 23-34", () => {
    expect(rankForLevel(23).tier).toBe("GOLD");
    expect(rankForLevel(34).tier).toBe("GOLD");
    expect(rankForLevel(35).tier).toBe("PLATINUM");
  });

  it("Platinum 35-48", () => {
    expect(rankForLevel(35).tier).toBe("PLATINUM");
    expect(rankForLevel(48).tier).toBe("PLATINUM");
    expect(rankForLevel(49).tier).toBe("DIAMOND");
  });

  it("Diamond 49-64", () => {
    expect(rankForLevel(49).tier).toBe("DIAMOND");
    expect(rankForLevel(64).tier).toBe("DIAMOND");
    expect(rankForLevel(65).tier).toBe("MASTER");
  });

  it("Master 65-79, no division", () => {
    expect(rankForLevel(65).tier).toBe("MASTER");
    expect(rankForLevel(65).division).toBeNull();
    expect(rankForLevel(79).tier).toBe("MASTER");
    expect(rankForLevel(80).tier).toBe("GRANDMASTER");
  });

  it("GrandMaster 80-99, no division", () => {
    expect(rankForLevel(80).division).toBeNull();
    expect(rankForLevel(99).tier).toBe("GRANDMASTER");
    expect(rankForLevel(100).tier).toBe("CHALLENGER");
  });

  it("Challenger 100+, open-ended, no division", () => {
    expect(rankForLevel(100).tier).toBe("CHALLENGER");
    expect(rankForLevel(100).division).toBeNull();
    expect(rankForLevel(500).tier).toBe("CHALLENGER");
  });
});

describe("rankForLevel: clamps low/invalid levels", () => {
  it("level 0 resolves to Iron IV instead of throwing", () => {
    const rank = rankForLevel(0);
    expect(rank.tier).toBe("IRON");
    expect(rank.division).toBe(4);
  });

  it("negative levels resolve to Iron IV instead of throwing", () => {
    const rank = rankForLevel(-10);
    expect(rank.tier).toBe("IRON");
    expect(rank.division).toBe(4);
  });

  it("level 1 resolves to Iron IV", () => {
    const rank = rankForLevel(1);
    expect(rank.tier).toBe("IRON");
    expect(rank.division).toBe(4);
  });
});

describe("rankForLevel: divisions", () => {
  it("Iron (span 4, band width 1) walks IV -> I", () => {
    expect(rankForLevel(1).division).toBe(4);
    expect(rankForLevel(2).division).toBe(3);
    expect(rankForLevel(3).division).toBe(2);
    expect(rankForLevel(4).division).toBe(1);
  });

  it("Bronze (span 8, band width 2) splits into four even bands", () => {
    expect(rankForLevel(5).division).toBe(4);
    expect(rankForLevel(6).division).toBe(4);
    expect(rankForLevel(7).division).toBe(3);
    expect(rankForLevel(8).division).toBe(3);
    expect(rankForLevel(9).division).toBe(2);
    expect(rankForLevel(10).division).toBe(2);
    expect(rankForLevel(11).division).toBe(1);
    expect(rankForLevel(12).division).toBe(1);
  });

  it("Diamond (span 16, band width 4): last level of the tier is division I", () => {
    expect(rankForLevel(49).division).toBe(4);
    expect(rankForLevel(52).division).toBe(4);
    expect(rankForLevel(53).division).toBe(3);
    expect(rankForLevel(60).division).toBe(2);
    expect(rankForLevel(61).division).toBe(1);
    expect(rankForLevel(64).division).toBe(1);
  });
});
