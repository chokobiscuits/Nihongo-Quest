import { describe, expect, it } from "vitest";
import { intervalForStage, isBurned, isGuruOrAbove, STAGES, stageInfo } from "./stages";

describe("SRS stage table", () => {
  it("has 10 stages, 0 through 9", () => {
    expect(STAGES).toHaveLength(10);
    expect(STAGES.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("matches the documented interval per stage", () => {
    expect(intervalForStage(1)).toBe(4 * 60 * 60 * 1000);
    expect(intervalForStage(2)).toBe(8 * 60 * 60 * 1000);
    expect(intervalForStage(3)).toBe(24 * 60 * 60 * 1000);
    expect(intervalForStage(4)).toBe(2 * 24 * 60 * 60 * 1000);
    expect(intervalForStage(5)).toBe(7 * 24 * 60 * 60 * 1000);
    expect(intervalForStage(6)).toBe(14 * 24 * 60 * 60 * 1000);
    expect(intervalForStage(7)).toBe(30 * 24 * 60 * 60 * 1000);
    expect(intervalForStage(8)).toBe(120 * 24 * 60 * 60 * 1000);
    expect(intervalForStage(9)).toBeNull();
  });

  it("burned (9) is never due again", () => {
    expect(isBurned(9)).toBe(true);
    expect(isBurned(8)).toBe(false);
  });

  it("guru starts at stage 5", () => {
    expect(isGuruOrAbove(5)).toBe(true);
    expect(isGuruOrAbove(4)).toBe(false);
  });

  it("throws on an unknown stage", () => {
    expect(() => stageInfo(10)).toThrow();
    expect(() => stageInfo(-1)).toThrow();
  });
});
