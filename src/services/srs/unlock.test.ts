import { describe, expect, it } from "vitest";
import { componentsSatisfied, isSubjectUnlocked, nextUserLevel } from "./unlock";

describe("componentsSatisfied", () => {
  it("is true with no components", () => {
    expect(componentsSatisfied([])).toBe(true);
  });

  it("requires every component to be Guru (>= 5)", () => {
    expect(
      componentsSatisfied([
        { childId: "a", srsStage: 5 },
        { childId: "b", srsStage: 8 },
      ]),
    ).toBe(true);

    expect(
      componentsSatisfied([
        { childId: "a", srsStage: 5 },
        { childId: "b", srsStage: 4 },
      ]),
    ).toBe(false);
  });

  it("treats a missing UserSubject (null stage) as not satisfied", () => {
    expect(componentsSatisfied([{ childId: "a", srsStage: null }])).toBe(false);
  });
});

describe("isSubjectUnlocked", () => {
  it("radicals unlock on level alone", () => {
    const radical = { id: "r1", type: "RADICAL" as const, level: 3, components: [] };
    expect(isSubjectUnlocked(radical, 3)).toBe(true);
    expect(isSubjectUnlocked(radical, 2)).toBe(false);
  });

  it("kanji unlock when in-level and all components are Guru'd", () => {
    const kanji = {
      id: "k1",
      type: "KANJI" as const,
      level: 2,
      components: [{ childId: "r1", srsStage: 5 }],
    };
    expect(isSubjectUnlocked(kanji, 2)).toBe(true);

    const kanjiNotGuru = {
      ...kanji,
      components: [{ childId: "r1", srsStage: 3 }],
    };
    expect(isSubjectUnlocked(kanjiNotGuru, 2)).toBe(false);
  });

  it("above-level subjects never unlock regardless of components", () => {
    const kanji = {
      id: "k1",
      type: "KANJI" as const,
      level: 5,
      components: [{ childId: "r1", srsStage: 9 }],
    };
    expect(isSubjectUnlocked(kanji, 4)).toBe(false);
  });
});

describe("nextUserLevel", () => {
  it("advances once 90% of the level's kanji are Guru'd", () => {
    const kanji = Array.from({ length: 10 }, (_, i) => ({ srsStage: i < 9 ? 5 : 3 }));
    expect(nextUserLevel(3, kanji)).toBe(4);
  });

  it("does not advance below the 90% threshold", () => {
    const kanji = Array.from({ length: 10 }, (_, i) => ({ srsStage: i < 8 ? 5 : 3 }));
    expect(nextUserLevel(3, kanji)).toBe(3);
  });

  it("does not advance with no kanji at that level", () => {
    expect(nextUserLevel(3, [])).toBe(3);
  });
});
