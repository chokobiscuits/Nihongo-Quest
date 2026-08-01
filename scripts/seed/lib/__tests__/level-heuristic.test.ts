import { describe, expect, it } from "vitest";
import {
  assignLevels,
  KANJI_LADDER_TARGET,
  KANJI_PER_LEVEL,
  LEVEL_COUNT,
  QUOTA_OVERRUN_TOLERANCE,
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
      row[byId.get(tempId)!.type] += 1;
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
