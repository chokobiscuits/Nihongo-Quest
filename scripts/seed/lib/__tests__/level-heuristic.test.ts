import { describe, expect, it } from "vitest";
import { assignLevels, topologicalOrder, type LevelInput } from "../level-heuristic";

describe("topologicalOrder", () => {
  it("places a radical before the kanji that depends on it", () => {
    const inputs: LevelInput[] = [
      { tempId: "kanji-休", type: "KANJI", grade: 2, frequency: 300, dependsOn: ["radical-人", "radical-木"] },
      { tempId: "radical-人", type: "RADICAL", grade: null, frequency: null, dependsOn: [] },
      { tempId: "radical-木", type: "RADICAL", grade: null, frequency: null, dependsOn: [] },
    ];
    const order = topologicalOrder(inputs);
    expect(order.indexOf("radical-人")).toBeLessThan(order.indexOf("kanji-休"));
    expect(order.indexOf("radical-木")).toBeLessThan(order.indexOf("kanji-休"));
  });

  it("places kanji before vocab that depends on them", () => {
    const inputs: LevelInput[] = [
      { tempId: "vocab-休む", type: "VOCAB", grade: null, frequency: 100, dependsOn: ["kanji-休"] },
      { tempId: "kanji-休", type: "KANJI", grade: 2, frequency: 300, dependsOn: [] },
    ];
    const order = topologicalOrder(inputs);
    expect(order.indexOf("kanji-休")).toBeLessThan(order.indexOf("vocab-休む"));
  });

  it("is deterministic across repeated calls on the same input", () => {
    const inputs: LevelInput[] = [
      { tempId: "b", type: "RADICAL", grade: null, frequency: null, dependsOn: [] },
      { tempId: "a", type: "RADICAL", grade: null, frequency: null, dependsOn: [] },
    ];
    expect(topologicalOrder(inputs)).toEqual(topologicalOrder(inputs));
  });

  it("throws on a dependency cycle", () => {
    const inputs: LevelInput[] = [
      { tempId: "a", type: "KANJI", grade: null, frequency: null, dependsOn: ["b"] },
      { tempId: "b", type: "KANJI", grade: null, frequency: null, dependsOn: ["a"] },
    ];
    expect(() => topologicalOrder(inputs)).toThrow();
  });

  it("ignores dependencies that point outside the seeded set", () => {
    const inputs: LevelInput[] = [{ tempId: "a", type: "KANJI", grade: null, frequency: null, dependsOn: ["missing"] }];
    expect(topologicalOrder(inputs)).toEqual(["a"]);
  });
});

describe("assignLevels", () => {
  it("never assigns a subject a lower level than its dependency", () => {
    const inputs: LevelInput[] = [
      { tempId: "radical-人", type: "RADICAL", grade: null, frequency: null, dependsOn: [] },
      { tempId: "kanji-休", type: "KANJI", grade: 2, frequency: 300, dependsOn: ["radical-人"] },
      { tempId: "vocab-休む", type: "VOCAB", grade: null, frequency: 100, dependsOn: ["kanji-休"] },
    ];
    const levels = assignLevels(inputs);
    expect(levels.get("radical-人")!).toBeLessThanOrEqual(levels.get("kanji-休")!);
    expect(levels.get("kanji-休")!).toBeLessThanOrEqual(levels.get("vocab-休む")!);
  });

  it("assigns levels within the 1-60 range", () => {
    const inputs: LevelInput[] = Array.from({ length: 500 }, (_, i) => ({
      tempId: `k${i}`,
      type: "KANJI" as const,
      grade: (i % 6) + 1,
      frequency: i,
      dependsOn: [],
    }));
    const levels = assignLevels(inputs);
    for (const level of levels.values()) {
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(60);
    }
  });

  it("orders radicals before kanji before vocab within the same wave", () => {
    const inputs: LevelInput[] = [
      { tempId: "vocab-a", type: "VOCAB", grade: null, frequency: 1, dependsOn: [] },
      { tempId: "kanji-a", type: "KANJI", grade: 1, frequency: 1, dependsOn: [] },
      { tempId: "radical-a", type: "RADICAL", grade: null, frequency: null, dependsOn: [] },
    ];
    const order = topologicalOrder(inputs);
    expect(order).toEqual(["radical-a", "kanji-a", "vocab-a"]);
  });
});
