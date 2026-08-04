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

  it("ignores non-gating components entirely, regardless of their stage", () => {
    expect(
      componentsSatisfied([
        { childId: "a", srsStage: 5 },
        { childId: "b", srsStage: 0, isGating: false },
      ]),
    ).toBe(true);

    expect(
      componentsSatisfied([
        { childId: "a", srsStage: 5 },
        { childId: "b", srsStage: null, isGating: false },
      ]),
    ).toBe(true);
  });

  it("still requires gating components to be Guru'd even when non-gating ones are present", () => {
    expect(
      componentsSatisfied([
        { childId: "a", srsStage: 3 },
        { childId: "b", srsStage: 9, isGating: false },
      ]),
    ).toBe(false);
  });

  it("unlocks freely when every component is non-gating", () => {
    expect(
      componentsSatisfied([
        { childId: "a", srsStage: null, isGating: false },
        { childId: "b", srsStage: 0, isGating: false },
      ]),
    ).toBe(true);
  });

  it("defaults an omitted isGating to gating (true), matching @default(true)", () => {
    expect(componentsSatisfied([{ childId: "a", srsStage: 4 }])).toBe(false);
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

  it("kana unlocks on level alone, same as radicals", () => {
    const kana = { id: "kn1", type: "KANA" as const, level: 2, components: [] };
    expect(isSubjectUnlocked(kana, 2)).toBe(true);
    expect(isSubjectUnlocked(kana, 1)).toBe(false);
  });

  describe("the kana gate on radicals", () => {
    const radical = { id: "r1", type: "RADICAL" as const, level: 1, components: [] };

    it("defaults kanaResolved to true, so existing callers that don't pass it are unaffected", () => {
      expect(isSubjectUnlocked(radical, 1)).toBe(true);
    });

    it("blocks a level-eligible radical when kana is not resolved", () => {
      expect(isSubjectUnlocked(radical, 1, false)).toBe(false);
    });

    it("unlocks a level-eligible radical once kana is resolved", () => {
      expect(isSubjectUnlocked(radical, 1, true)).toBe(true);
    });

    it("still respects the level check even when kana is resolved", () => {
      const highLevelRadical = { ...radical, level: 5 };
      expect(isSubjectUnlocked(highLevelRadical, 1, true)).toBe(false);
    });

    it("cannot deadlock: kanaResolved=true always unlocks an in-level radical regardless of kana subject state elsewhere", () => {
      // This is the "skip" case in miniature — once kana is resolved (passed
      // or skipped), radicals unlock immediately, with no further
      // dependency on any kana UserSubject row's specifics.
      expect(isSubjectUnlocked(radical, 1, true)).toBe(true);
    });
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
