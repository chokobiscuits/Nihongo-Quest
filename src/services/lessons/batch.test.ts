import { describe, expect, it } from "vitest";
import { selectLessonBatch, type LessonCandidate } from "./batch";

function candidate(overrides: Partial<LessonCandidate> & { id: string }): LessonCandidate {
  return { type: "RADICAL", level: 1, frequency: null, ...overrides };
}

describe("selectLessonBatch", () => {
  it("orders radicals before kanji before vocab", () => {
    const pool = [
      candidate({ id: "v1", type: "VOCAB", level: 1 }),
      candidate({ id: "k1", type: "KANJI", level: 1 }),
      candidate({ id: "r1", type: "RADICAL", level: 1 }),
    ];
    const batch = selectLessonBatch(pool, 10);
    expect(batch.map((c) => c.id)).toEqual(["r1", "k1", "v1"]);
  });

  it("orders by level within a type", () => {
    const pool = [
      candidate({ id: "r-lvl3", type: "RADICAL", level: 3 }),
      candidate({ id: "r-lvl1", type: "RADICAL", level: 1 }),
      candidate({ id: "r-lvl2", type: "RADICAL", level: 2 }),
    ];
    const batch = selectLessonBatch(pool, 10);
    expect(batch.map((c) => c.id)).toEqual(["r-lvl1", "r-lvl2", "r-lvl3"]);
  });

  it("orders by frequency within a type and level, unranked last", () => {
    const pool = [
      candidate({ id: "unranked", type: "VOCAB", level: 1, frequency: null }),
      candidate({ id: "common", type: "VOCAB", level: 1, frequency: 5 }),
      candidate({ id: "rare", type: "VOCAB", level: 1, frequency: 500 }),
    ];
    const batch = selectLessonBatch(pool, 10);
    expect(batch.map((c) => c.id)).toEqual(["common", "rare", "unranked"]);
  });

  it("truncates to the batch size", () => {
    const pool = Array.from({ length: 10 }, (_, i) => candidate({ id: `r${i}` }));
    expect(selectLessonBatch(pool, 5)).toHaveLength(5);
  });

  it("defaults to a batch size of 5", () => {
    const pool = Array.from({ length: 10 }, (_, i) => candidate({ id: `r${i}` }));
    expect(selectLessonBatch(pool)).toHaveLength(5);
  });

  it("returns an empty batch for an empty pool", () => {
    expect(selectLessonBatch([], 5)).toEqual([]);
  });
});
