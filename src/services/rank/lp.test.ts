import { describe, expect, it } from "vitest";
import {
  applyLp,
  lpDeltaFor,
  resolveSession,
  startingRank,
  lpFraction,
  NEUTRAL_ACCURACY,
  LP_PER_DIVISION,
  DEMOTION_LANDING_LP,
  type RankState,
} from "./lp";

const at = (tier: RankState["tier"], division: number | null, lp: number): RankState => ({
  tier,
  division,
  lp,
});

describe("lpDeltaFor", () => {
  it("is neutral at exactly the neutral accuracy", () => {
    const { delta } = lpDeltaFor({ itemsCorrect: 8, itemsTotal: 10 });
    expect(NEUTRAL_ACCURACY).toBe(0.8);
    expect(delta).toBe(0);
  });

  it("gains above neutral, loses below", () => {
    expect(lpDeltaFor({ itemsCorrect: 10, itemsTotal: 10 }).delta).toBeGreaterThan(0);
    expect(lpDeltaFor({ itemsCorrect: 5, itemsTotal: 10 }).delta).toBeLessThan(0);
  });

  it("awards nothing for sessions too small to be meaningful", () => {
    expect(lpDeltaFor({ itemsCorrect: 2, itemsTotal: 2 }).delta).toBe(0);
    expect(lpDeltaFor({ itemsCorrect: 0, itemsTotal: 1 }).delta).toBe(0);
  });

  it("scales the swing with session size", () => {
    const small = lpDeltaFor({ itemsCorrect: 4, itemsTotal: 4 }).delta;
    const large = lpDeltaFor({ itemsCorrect: 40, itemsTotal: 40 }).delta;
    expect(large).toBeGreaterThan(small);
  });

  it("dampens losses relative to equivalent gains", () => {
    // Symmetric distance either side of neutral: 100% vs 60%.
    const gain = lpDeltaFor({ itemsCorrect: 10, itemsTotal: 10 }).delta;
    const loss = lpDeltaFor({ itemsCorrect: 6, itemsTotal: 10 }).delta;
    expect(Math.abs(loss)).toBeLessThan(gain);
  });

  it("flags an S-rank session", () => {
    const { bonus } = lpDeltaFor({ itemsCorrect: 19, itemsTotal: 20 });
    expect(bonus).toBe("s-rank");
  });

  it("flags a perfect clear over a large session", () => {
    const { bonus } = lpDeltaFor({ itemsCorrect: 30, itemsTotal: 30 });
    expect(bonus).toBe("perfect");
  });

  it("does not award a bonus on a losing session", () => {
    expect(lpDeltaFor({ itemsCorrect: 3, itemsTotal: 30 }).bonus).toBeNull();
  });

  it("swings harder for exams", () => {
    const review = lpDeltaFor({ itemsCorrect: 10, itemsTotal: 10 }).delta;
    const exam = lpDeltaFor({ itemsCorrect: 10, itemsTotal: 10, isExam: true }).delta;
    expect(exam).toBeGreaterThan(review);
  });
});

describe("applyLp promotion", () => {
  it("carries the remainder across a division boundary", () => {
    const out = applyLp(at("SILVER", 3, 90), 25);
    expect(out.after).toEqual({ tier: "SILVER", division: 2, lp: 15 });
    expect(out.change).toBe("promoted");
    expect(out.divisionsMoved).toBe(1);
  });

  it("promotes to the next tier from division I", () => {
    const out = applyLp(at("BRONZE", 1, 95), 20);
    expect(out.after.tier).toBe("SILVER");
    expect(out.after.division).toBe(4);
    expect(out.after.lp).toBe(15);
    expect(out.tierPromoted).toBe(true);
  });

  // The requirement that motivated the over-achievement multipliers: a
  // genuinely great session should be able to jump two divisions.
  it("allows a double promotion on a large enough gain", () => {
    const out = applyLp(at("GOLD", 3, 50), 160);
    expect(out.divisionsMoved).toBe(2);
    expect(out.after).toEqual({ tier: "GOLD", division: 1, lp: 10 });
  });

  it("is reachable end to end from a perfect large session", () => {
    // A perfect 40-item session from a high-LP position must double-promote,
    // otherwise the multipliers are mistuned.
    const { delta } = lpDeltaFor({ itemsCorrect: 40, itemsTotal: 40 });
    const out = applyLp(at("SILVER", 3, 95), delta);
    expect(delta).toBeGreaterThanOrEqual(2 * LP_PER_DIVISION - 95);
    expect(out.divisionsMoved).toBeGreaterThanOrEqual(2);
  });
});

describe("applyLp demotion", () => {
  it("drops a division and lands at the buffer", () => {
    const out = applyLp(at("GOLD", 2, 10), -30);
    expect(out.after).toEqual({ tier: "GOLD", division: 3, lp: DEMOTION_LANDING_LP });
    expect(out.change).toBe("demoted");
    expect(out.divisionsMoved).toBe(-1);
  });

  it("never drops out of a tier: division IV floors at 0 LP", () => {
    const out = applyLp(at("GOLD", 4, 5), -60);
    expect(out.after).toEqual({ tier: "GOLD", division: 4, lp: 0 });
    expect(out.change).toBeNull();
    expect(out.after.tier).toBe("GOLD");
  });

  it("floors at Iron IV for a brand new account", () => {
    const out = applyLp(startingRank(), -50);
    expect(out.after).toEqual({ tier: "IRON", division: 4, lp: 0 });
  });
});

describe("apex tiers", () => {
  it("enters Master with the carried remainder and no division", () => {
    const out = applyLp(at("DIAMOND", 1, 90), 30);
    expect(out.after.tier).toBe("MASTER");
    expect(out.after.division).toBeNull();
    expect(out.after.lp).toBe(20);
  });

  it("crosses into Grandmaster and Challenger on the same pool", () => {
    expect(applyLp(at("MASTER", null, 490), 20).after.tier).toBe("GRANDMASTER");
    expect(applyLp(at("GRANDMASTER", null, 990), 20).after.tier).toBe("CHALLENGER");
  });

  it("never falls out of Master once reached", () => {
    const out = applyLp(at("MASTER", null, 10), -500);
    expect(out.after.tier).toBe("MASTER");
    expect(out.after.lp).toBe(0);
  });
});

describe("resolveSession", () => {
  it("moves rank end to end from a session result", () => {
    const out = resolveSession(at("IRON", 4, 90), { itemsCorrect: 20, itemsTotal: 20 });
    expect(out.change).toBe("promoted");
    expect(out.bonus).toBe("s-rank");
  });

  it("is a no-op for a neutral session", () => {
    const before = at("SILVER", 2, 40);
    const out = resolveSession(before, { itemsCorrect: 8, itemsTotal: 10 });
    expect(out.after).toEqual(before);
    expect(out.change).toBeNull();
  });
});

describe("lpFraction", () => {
  it("measures progress through a division", () => {
    expect(lpFraction(at("GOLD", 2, 50))).toBeCloseTo(0.5);
    expect(lpFraction(at("GOLD", 2, 0))).toBe(0);
  });

  it("measures apex tiers against the next threshold", () => {
    expect(lpFraction(at("MASTER", null, 250))).toBeCloseTo(0.5);
    expect(lpFraction(at("CHALLENGER", null, 1200))).toBe(1);
  });
});
