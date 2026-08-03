import { describe, expect, it } from "vitest";
import { buildReviewQueue, buildResolutionState, questionKindsFor } from "./queue";

describe("questionKindsFor", () => {
  it("radicals are meaning-only", () => {
    expect(questionKindsFor("RADICAL")).toEqual(["MEANING"]);
  });

  it("kanji and vocab need both meaning and reading", () => {
    expect(questionKindsFor("KANJI")).toEqual(["MEANING", "READING"]);
    expect(questionKindsFor("VOCAB")).toEqual(["MEANING", "READING"]);
  });

  it("sentences are meaning-only — furigana is already shown on the question card", () => {
    expect(questionKindsFor("SENTENCE")).toEqual(["MEANING"]);
  });
});

describe("buildReviewQueue", () => {
  it("generates one question for a radical, two for kanji/vocab", () => {
    const queue = buildReviewQueue([
      { userSubjectId: "r1", subjectType: "RADICAL" },
      { userSubjectId: "k1", subjectType: "KANJI" },
    ]);
    expect(queue).toHaveLength(3);
    expect(queue.filter((q) => q.userSubjectId === "r1")).toHaveLength(1);
    expect(queue.filter((q) => q.userSubjectId === "k1")).toHaveLength(2);
  });

  it("never places an item's meaning and reading questions adjacently", () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      userSubjectId: `k${i}`,
      subjectType: "KANJI" as const,
    }));
    const queue = buildReviewQueue(candidates);
    for (let i = 0; i < queue.length - 1; i++) {
      if (queue[i].userSubjectId === queue[i + 1].userSubjectId) {
        throw new Error(`adjacent questions for ${queue[i].userSubjectId} at index ${i}`);
      }
    }
  });

  it("interleaves meaning and reading kinds rather than grouping by item", () => {
    const queue = buildReviewQueue([
      { userSubjectId: "k1", subjectType: "KANJI" },
      { userSubjectId: "k2", subjectType: "KANJI" },
    ]);
    // k1-meaning, k1-reading grouped together would prime the reading
    // answer; the offset riffle instead separates every item's own pair.
    expect(queue).toEqual([
      { userSubjectId: "k1", kind: "MEANING" },
      { userSubjectId: "k2", kind: "MEANING" },
      { userSubjectId: "k1", kind: "READING" },
      { userSubjectId: "k2", kind: "READING" },
    ]);
  });

  it("includes a trailing meaning-only (radical) question without adjacency to its own item", () => {
    const queue = buildReviewQueue([
      { userSubjectId: "k1", subjectType: "KANJI" },
      { userSubjectId: "r1", subjectType: "RADICAL" },
    ]);
    expect(queue).toEqual([
      { userSubjectId: "k1", kind: "MEANING" },
      { userSubjectId: "r1", kind: "MEANING" },
      { userSubjectId: "k1", kind: "READING" },
    ]);
  });

  it("returns an empty queue for no candidates", () => {
    expect(buildReviewQueue([])).toEqual([]);
  });
});

describe("buildResolutionState", () => {
  it("tracks outstanding kinds per item, starting at zero incorrect", () => {
    const state = buildResolutionState([
      { userSubjectId: "r1", subjectType: "RADICAL" },
      { userSubjectId: "k1", subjectType: "KANJI" },
    ]);
    expect(state.get("r1")?.remainingKinds).toEqual(new Set(["MEANING"]));
    expect(state.get("k1")?.remainingKinds).toEqual(new Set(["MEANING", "READING"]));
    expect(state.get("r1")?.incorrectCount).toBe(0);
  });
});
