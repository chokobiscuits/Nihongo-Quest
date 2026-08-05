import { describe, expect, it } from "vitest";
import {
  assignLevels,
  assignSentenceLevels,
  sentenceLengthCeiling,
  SENTENCE_LENGTH_MIN_CEILING,
  SENTENCE_LENGTH_MAX_CEILING,
  KANJI_LADDER_TARGET,
  KANJI_PER_LEVEL,
  LEVEL_COUNT,
  QUOTA_OVERRUN_TOLERANCE,
  SENTENCE_PER_LEVEL,
  VOCAB_LADDER_TARGET,
  VOCAB_PER_LEVEL,
  type LevelInput,
} from "../level-heuristic";

function radical(tempId: string, dependsOn: string[] = []): LevelInput {
  return { tempId, type: "RADICAL", grade: null, frequency: null, jlpt: null, isCommon: false, dependsOn };
}

function kanji(
  tempId: string,
  opts: { jlpt?: number | null; frequency?: number | null; dependsOn?: string[] } = {},
): LevelInput {
  return {
    tempId,
    type: "KANJI",
    grade: null,
    frequency: opts.frequency ?? null,
    jlpt: opts.jlpt ?? null,
    isCommon: false,
    dependsOn: opts.dependsOn ?? [],
  };
}

function vocab(
  tempId: string,
  opts: { frequency?: number | null; isCommon?: boolean; dependsOn?: string[] } = {},
): LevelInput {
  return {
    tempId,
    type: "VOCAB",
    grade: null,
    frequency: opts.frequency ?? null,
    jlpt: null,
    isCommon: opts.isCommon ?? true,
    dependsOn: opts.dependsOn ?? [],
  };
}

describe("assignLevels", () => {
  it("never assigns a subject a lower level than its dependency", () => {
    const inputs: LevelInput[] = [
      radical("radical-人"),
      kanji("kanji-休", { jlpt: 5, frequency: 300, dependsOn: ["radical-人"] }),
      vocab("vocab-休む", { frequency: 100, dependsOn: ["kanji-休"] }),
    ];
    const levels = assignLevels(inputs);
    expect(levels.get("radical-人")!).not.toBeNull();
    expect(levels.get("kanji-休")!).not.toBeNull();
    expect(levels.get("vocab-休む")!).not.toBeNull();
    expect(levels.get("radical-人")!).toBeLessThanOrEqual(levels.get("kanji-休")!);
    expect(levels.get("kanji-休")!).toBeLessThanOrEqual(levels.get("vocab-休む")!);
  });

  it("assigns laddered levels within the 1-60 range", () => {
    const inputs: LevelInput[] = Array.from({ length: 500 }, (_, i) => kanji(`k${i}`, { jlpt: 5, frequency: i }));
    const levels = assignLevels(inputs);
    for (const level of levels.values()) {
      expect(level).not.toBeNull();
      expect(level as number).toBeGreaterThanOrEqual(1);
      expect(level as number).toBeLessThanOrEqual(60);
    }
  });

  it("caps the ladder at KANJI_LADDER_TARGET, pushing the rest to null", () => {
    const total = KANJI_LADDER_TARGET + 200;
    const inputs: LevelInput[] = Array.from({ length: total }, (_, i) => kanji(`k${i}`, { jlpt: 5, frequency: i }));
    const levels = assignLevels(inputs);
    const laddered = [...levels.values()].filter((l) => l !== null);
    const nulled = [...levels.values()].filter((l) => l === null);
    expect(laddered.length).toBeLessThanOrEqual(KANJI_LADDER_TARGET + KANJI_PER_LEVEL); // allow one level's tolerance for overflow bucket
    expect(nulled.length).toBeGreaterThan(0);
  });

  it("prefers JLPT-banded kanji (N5 first) over non-JLPT kanji when selecting the ladder", () => {
    const inputs: LevelInput[] = [
      ...Array.from({ length: 50 }, (_, i) => kanji(`n5-${i}`, { jlpt: 5, frequency: 1000 + i })),
      ...Array.from({ length: 50 }, (_, i) => kanji(`n1-${i}`, { jlpt: 1, frequency: 1000 + i })),
      ...Array.from({ length: 50 }, (_, i) => kanji(`nojlpt-${i}`, { jlpt: null, frequency: i })), // very common but untagged
    ];
    const levels = assignLevels(inputs);
    const n5Level = levels.get("n5-0")!;
    const nojlptLevel = levels.get("nojlpt-0");
    expect(n5Level).not.toBeNull();
    // N5 kanji, being JLPT-tagged, land at or before non-JLPT kanji of
    // similar/better frequency since JLPT band is the primary sort key.
    if (nojlptLevel !== null && nojlptLevel !== undefined) {
      expect(n5Level as number).toBeLessThanOrEqual(nojlptLevel as number);
    }
  });

  it("excludes non-JLPT kanji whose frequency is worse than the ceiling, once JLPT kanji fill the ladder", () => {
    const jlptFilling = Array.from({ length: KANJI_LADDER_TARGET }, (_, i) => kanji(`jlpt-${i}`, { jlpt: 5, frequency: i }));
    const poorFrequency = kanji("obscure", { jlpt: null, frequency: 9000 });
    const levels = assignLevels([...jlptFilling, poorFrequency]);
    expect(levels.get("obscure")).toBeNull();
  });

  it("only ladders vocab whose kanji dependencies are all laddered", () => {
    const inputs: LevelInput[] = [
      kanji("kanji-a", { jlpt: 5, frequency: 1 }),
      vocab("vocab-ok", { frequency: 1, dependsOn: ["kanji-a"] }),
      vocab("vocab-orphan", { frequency: 1, dependsOn: ["kanji-missing"] }),
    ];
    const levels = assignLevels(inputs);
    expect(levels.get("vocab-ok")).not.toBeNull();
    expect(levels.get("vocab-orphan")).toBeNull();
  });

  it("caps the vocab ladder at VOCAB_LADDER_TARGET", () => {
    const kanjiInput = kanji("kanji-a", { jlpt: 5, frequency: 1 });
    const vocabInputs = Array.from({ length: VOCAB_LADDER_TARGET + 100 }, (_, i) =>
      vocab(`v${i}`, { frequency: i, dependsOn: ["kanji-a"] }),
    );
    const levels = assignLevels([kanjiInput, ...vocabInputs]);
    const ladderedVocab = vocabInputs.filter((v) => levels.get(v.tempId) !== null);
    expect(ladderedVocab.length).toBeLessThanOrEqual(VOCAB_LADDER_TARGET + VOCAB_PER_LEVEL);
    expect(ladderedVocab.length).toBeGreaterThan(0);
    expect(vocabInputs.some((v) => levels.get(v.tempId) === null)).toBe(true);
  });

  it("is deterministic across repeated calls on the same input", () => {
    const inputs: LevelInput[] = [
      kanji("b", { jlpt: 3, frequency: 50 }),
      kanji("a", { jlpt: 3, frequency: 50 }),
      radical("r1"),
      radical("r2"),
    ];
    const first = assignLevels(inputs);
    const second = assignLevels(inputs);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it("throws on a dependency cycle within the selected set", () => {
    const inputs: LevelInput[] = [
      kanji("a", { jlpt: 5, dependsOn: ["b"] }),
      kanji("b", { jlpt: 5, dependsOn: ["a"] }),
    ];
    expect(() => assignLevels(inputs)).toThrow();
  });

  it("does not exceed a level's type quota by more than the overrun tolerance, absent dependency pressure", () => {
    const inputs: LevelInput[] = Array.from({ length: KANJI_LADDER_TARGET }, (_, i) =>
      kanji(`k${i}`, { jlpt: 5, frequency: i }),
    );
    const levels = assignLevels(inputs);
    const perLevel = new Map<number, number>();
    for (const level of levels.values()) {
      if (level === null) continue;
      perLevel.set(level, (perLevel.get(level) ?? 0) + 1);
    }
    for (const count of perLevel.values()) {
      expect(count).toBeLessThanOrEqual(KANJI_PER_LEVEL * (1 + QUOTA_OVERRUN_TOLERANCE));
    }
  });

  it("builds a full curriculum where level 1 has both radicals and kanji, and levels 1-60 each have kanji plus radical-or-vocab", () => {
    const radicals = Array.from({ length: 30 }, (_, i) => radical(`r${i}`));
    const kanjiInputs = Array.from({ length: KANJI_LADDER_TARGET }, (_, i) =>
      kanji(`k${i}`, { jlpt: 5, frequency: i, dependsOn: [radicals[i % radicals.length].tempId] }),
    );
    const vocabInputs = Array.from({ length: VOCAB_LADDER_TARGET }, (_, i) =>
      vocab(`v${i}`, { frequency: i, dependsOn: [kanjiInputs[i % kanjiInputs.length].tempId] }),
    );
    const levels = assignLevels([...radicals, ...kanjiInputs, ...vocabInputs]);

    const byLevel = new Map<number, Record<"RADICAL" | "KANJI" | "VOCAB", number>>();
    const byId = new Map([...radicals, ...kanjiInputs, ...vocabInputs].map((i) => [i.tempId, i]));
    for (const [tempId, level] of levels) {
      if (level === null) continue;
      const row = byLevel.get(level) ?? { RADICAL: 0, KANJI: 0, VOCAB: 0 };
      row[byId.get(tempId)!.type as "RADICAL" | "KANJI" | "VOCAB"] += 1;
      byLevel.set(level, row);
    }

    for (let level = 1; level <= LEVEL_COUNT; level += 1) {
      const row = byLevel.get(level) ?? { RADICAL: 0, KANJI: 0, VOCAB: 0 };
      expect(row.KANJI).toBeGreaterThan(0);
      expect(row.RADICAL + row.VOCAB).toBeGreaterThan(0);
    }
    const level1 = byLevel.get(1)!;
    expect(level1.RADICAL).toBeGreaterThan(0);
    expect(level1.KANJI).toBeGreaterThan(0);
  });
});

describe("assignSentenceLevels", () => {
  it("places a sentence strictly after the max level of its vocab dependencies", () => {
    const vocabLevels = new Map<string, number | null>([
      ["v1", 3],
      ["v2", 5],
    ]);
    const levels = assignSentenceLevels(
      [{ tempId: "s1", vocabTempIds: ["v1", "v2"] }],
      vocabLevels,
    );
    expect(levels.get("s1")).toBe(6);
  });

  it("ignores off-ladder (unlevelled) vocab dependencies and gates only on laddered ones", () => {
    const vocabLevels = new Map<string, number | null>([
      ["v1", 3],
      ["v2", null],
    ]);
    const levels = assignSentenceLevels(
      [{ tempId: "s1", vocabTempIds: ["v1", "v2"] }],
      vocabLevels,
    );
    expect(levels.get("s1")).toBe(4);
  });

  it("places a sentence whose content vocab is entirely off-ladder at level 1", () => {
    const vocabLevels = new Map<string, number | null>([["v1", null]]);
    const levels = assignSentenceLevels(
      [{ tempId: "s1", vocabTempIds: ["v1"] }],
      vocabLevels,
    );
    expect(levels.get("s1")).toBe(1);
  });

  it("places a sentence with no vocab dependencies at level 1", () => {
    const levels = assignSentenceLevels([{ tempId: "s1", vocabTempIds: [] }], new Map());
    expect(levels.get("s1")).toBe(1);
  });

  it("respects SENTENCE_PER_LEVEL quota, overflowing later sentences to the next eligible level", () => {
    const vocabLevels = new Map<string, number | null>([["v1", 1]]);
    const inputs = Array.from({ length: SENTENCE_PER_LEVEL + 2 }, (_, i) => ({
      tempId: `s${i}`,
      vocabTempIds: ["v1"],
    }));
    const levels = assignSentenceLevels(inputs, vocabLevels);
    const byLevel = new Map<number, number>();
    for (const level of levels.values()) {
      if (level === null) continue;
      byLevel.set(level, (byLevel.get(level) ?? 0) + 1);
    }
    expect(byLevel.get(2)).toBe(SENTENCE_PER_LEVEL);
    expect(byLevel.get(3)).toBe(2);
  });

  it("prefers in-band sentences over long ones when a level is over-subscribed", () => {
    const vocabLevels = new Map<string, number | null>([["v1", null]]);
    // Every sentence is level-1 eligible, so the quota alone decides who gets
    // in. The first 5 in input order are far outside level 1's band; the rest
    // sit inside it. Corpus order and band membership disagree completely.
    const inputs = Array.from({ length: SENTENCE_PER_LEVEL + 5 }, (_, i) => ({
      tempId: `s${i}`,
      vocabTempIds: ["v1"],
      charLength: i < 5 ? 90 : 8,
    }));
    const levels = assignSentenceLevels(inputs, vocabLevels);
    // The 5 over-length ones lose their level-1 slots despite coming first.
    for (const tempId of ["s0", "s1", "s2", "s3", "s4"]) {
      expect(levels.get(tempId)).toBe(2);
    }
    expect(levels.get(`s${SENTENCE_PER_LEVEL + 4}`)).toBe(1);
  });

  it("keeps corpus order within a length bucket rather than stacking shortest first", () => {
    const vocabLevels = new Map<string, number | null>([["v1", null]]);
    // All lengths sit inside level 1's band AND inside one bucket (floor(n/5)
    // is 0 for 1..4), so nothing reorders: pure input order decides.
    const inputs = Array.from({ length: SENTENCE_PER_LEVEL + 2 }, (_, i) => ({
      tempId: `s${i}`,
      vocabTempIds: ["v1"],
      // Descending lengths: a strict shortest-first sort would invert these.
      charLength: 4 - (i % 4),
    }));
    const levels = assignSentenceLevels(inputs, vocabLevels);
    expect(levels.get("s0")).toBe(1);
    expect(levels.get(`s${SENTENCE_PER_LEVEL}`)).toBe(2);
    expect(levels.get(`s${SENTENCE_PER_LEVEL + 1}`)).toBe(2);
  });

  it("still fills a level to quota when the band cannot supply enough sentences", () => {
    const vocabLevels = new Map<string, number | null>([["v1", null]]);
    // Every sentence is far over level 1's ceiling. The band is a preference,
    // not a filter, so the level must still fill rather than starve.
    const inputs = Array.from({ length: SENTENCE_PER_LEVEL }, (_, i) => ({
      tempId: `s${i}`,
      vocabTempIds: ["v1"],
      charLength: 200,
    }));
    const levels = assignSentenceLevels(inputs, vocabLevels);
    const atLevelOne = [...levels.values()].filter((l) => l === 1).length;
    expect(atLevelOne).toBe(SENTENCE_PER_LEVEL);
  });

  it("widens the length ceiling monotonically across the ladder", () => {
    expect(sentenceLengthCeiling(1)).toBe(SENTENCE_LENGTH_MIN_CEILING);
    expect(sentenceLengthCeiling(LEVEL_COUNT)).toBe(SENTENCE_LENGTH_MAX_CEILING);
    for (let level = 2; level <= LEVEL_COUNT; level += 1) {
      expect(sentenceLengthCeiling(level)).toBeGreaterThanOrEqual(sentenceLengthCeiling(level - 1));
    }
  });

  it("never places a sentence at or before the level of any vocab it contains (strict invariant)", () => {
    const vocabLevels = new Map<string, number | null>([
      ["v1", 10],
      ["v2", 4],
    ]);
    const levels = assignSentenceLevels(
      [{ tempId: "s1", vocabTempIds: ["v1", "v2"] }],
      vocabLevels,
    );
    const sentenceLevel = levels.get("s1")!;
    expect(sentenceLevel).not.toBeNull();
    for (const vocabTempId of ["v1", "v2"]) {
      expect(sentenceLevel!).toBeGreaterThan(vocabLevels.get(vocabTempId)!);
    }
  });
});
