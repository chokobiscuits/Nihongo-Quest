import { describe, expect, it } from "vitest";
import { masteryLevelFromXp, masteryXpForCorrectAnswer } from "./mastery";

describe("masteryXpForCorrectAnswer", () => {
  it("awards 10 xp", () => {
    expect(masteryXpForCorrectAnswer()).toBe(10);
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
