import { describe, expect, it } from "vitest";
import { curriculumLevel, type LevelGuruStats } from "./curriculum";

describe("curriculumLevel", () => {
  it("is 1 when there is no laddered content at all", () => {
    expect(curriculumLevel([])).toBe(1);
  });

  it("is 1 when level 1 has zero Guru'd subjects", () => {
    const stats: LevelGuruStats[] = [{ level: 1, total: 20, guruCount: 0 }];
    expect(curriculumLevel(stats)).toBe(1);
  });

  it("is 1 when level 1 is below the 90% threshold", () => {
    const stats: LevelGuruStats[] = [{ level: 1, total: 20, guruCount: 17 }]; // 85%
    expect(curriculumLevel(stats)).toBe(1);
  });

  it("advances to 2 exactly at the 90% threshold", () => {
    const stats: LevelGuruStats[] = [{ level: 1, total: 20, guruCount: 18 }]; // exactly 90%
    expect(curriculumLevel(stats)).toBe(2);
  });

  it("advances to 2 above the 90% threshold", () => {
    const stats: LevelGuruStats[] = [{ level: 1, total: 20, guruCount: 20 }];
    expect(curriculumLevel(stats)).toBe(2);
  });

  it("stops at the first incomplete level even if later levels look complete", () => {
    const stats: LevelGuruStats[] = [
      { level: 1, total: 20, guruCount: 20 },
      { level: 2, total: 20, guruCount: 10 }, // incomplete
      { level: 3, total: 20, guruCount: 20 }, // complete but unreachable
    ];
    expect(curriculumLevel(stats)).toBe(2);
  });

  it("walks multiple consecutive complete levels", () => {
    const stats: LevelGuruStats[] = [
      { level: 1, total: 20, guruCount: 20 },
      { level: 2, total: 20, guruCount: 20 },
      { level: 3, total: 20, guruCount: 20 },
    ];
    expect(curriculumLevel(stats)).toBe(4);
  });

  it("treats a level with zero total subjects as incomplete (stops there)", () => {
    const stats: LevelGuruStats[] = [
      { level: 1, total: 20, guruCount: 20 },
      { level: 2, total: 0, guruCount: 0 },
    ];
    expect(curriculumLevel(stats)).toBe(2);
  });

  it("handles a gap in the level sequence (missing level treated as incomplete)", () => {
    const stats: LevelGuruStats[] = [
      { level: 1, total: 20, guruCount: 20 },
      { level: 3, total: 20, guruCount: 20 },
    ];
    expect(curriculumLevel(stats)).toBe(2);
  });
});
