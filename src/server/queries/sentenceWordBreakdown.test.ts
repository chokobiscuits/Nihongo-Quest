import { describe, expect, it } from "vitest";
import { sentenceWordBreakdown, tatoebaSentenceIdOf } from "./sentenceWordBreakdown";

function link(overrides: Partial<Parameters<typeof sentenceWordBreakdown>[1][number]>) {
  return {
    readingUsed: null,
    isGating: true,
    child: { id: "id", slug: "slug", characters: null, meanings: [], readings: [], type: "VOCAB" as const },
    ...overrides,
  };
}

describe("sentenceWordBreakdown", () => {
  it("matches tokens to children by dictionary-form characters, ordered by sentence position", () => {
    const metadata = {
      tokens: [
        { surface: "今回", start: 0, end: 2, isContent: true },
        { surface: "は", start: 2, end: 3, isContent: false },
        { surface: "蛋白", start: 3, end: 5, isContent: true },
      ],
    };
    const links = [
      link({ isGating: true, child: { id: "vocab-tanpaku", slug: "vocab-tanpaku", characters: "蛋白", meanings: [], readings: [], type: "VOCAB" } }),
      link({ isGating: false, child: { id: "vocab-wa", slug: "vocab-wa", characters: "は", meanings: [], readings: [], type: "VOCAB" } }),
      link({ isGating: true, child: { id: "vocab-konkai", slug: "vocab-konkai", characters: "今回", meanings: [], readings: [], type: "VOCAB" } }),
    ];

    const result = sentenceWordBreakdown(metadata, links);

    expect(result.map((r) => r.id)).toEqual(["vocab-konkai", "vocab-wa", "vocab-tanpaku"]);
    expect(result.map((r) => r.surface)).toEqual(["今回", "は", "蛋白"]);
    expect(result.map((r) => r.isGating)).toEqual([true, false, true]);
  });

  it("matches an inflected surface via the child's kana reading when characters don't match literally", () => {
    const metadata = {
      tokens: [{ surface: "出た", start: 0, end: 2, isContent: true }],
    };
    const links = [
      link({
        isGating: true,
        child: {
          id: "vocab-deru",
          slug: "vocab-deru",
          characters: "出る",
          meanings: [],
          readings: [{ reading: "出た", primary: true }],
          type: "VOCAB",
        },
      }),
    ];

    const result = sentenceWordBreakdown(metadata, links);
    expect(result[0].surface).toBe("出た");
  });

  it("falls back to the next unclaimed token when no content/reading match is found", () => {
    const metadata = { tokens: [{ surface: "ことがあります", start: 0, end: 7, isContent: true }] };
    const links = [link({ child: { id: "vocab-x", slug: "vocab-x", characters: "事がある", meanings: [], readings: [], type: "VOCAB" } })];

    const result = sentenceWordBreakdown(metadata, links);
    expect(result[0].surface).toBe("ことがあります");
  });

  it("returns undefined surface when metadata has no tokens", () => {
    const links = [link({ child: { id: "vocab-x", slug: "vocab-x", characters: "何か", meanings: [], readings: [], type: "VOCAB" } })];
    const result = sentenceWordBreakdown({}, links);
    expect(result[0].surface).toBeUndefined();
  });
});

describe("tatoebaSentenceIdOf", () => {
  it("reads the id off metadata", () => {
    expect(tatoebaSentenceIdOf({ tatoebaSentenceId: "12345" })).toBe("12345");
  });

  it("returns null when absent", () => {
    expect(tatoebaSentenceIdOf({})).toBeNull();
    expect(tatoebaSentenceIdOf(null)).toBeNull();
  });
});
